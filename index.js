//  COPYRIGHT:       DouHub Inc. (C) 2021 All Right Reserved
//  COMPANY URL:     https://www.douhub.com/
//  CONTACT:         developer@douhub.com
// 
//  This source is subject to the DouHub License Agreements. 
// 
//  Our EULAs define the terms of use and license for each DouHub product. 
//  Whenever you install a DouHub product or research DouHub source code file, you will be prompted to review and accept the terms of our EULA. 
//  If you decline the terms of the EULA, the installation should be aborted and you should remove any and all copies of our products and source code from your computer. 
//  If you accept the terms of our EULA, you must abide by all its terms as long as our technologies are being employed within your organization and within your applications.
// 
//  THIS CODE AND INFORMATION IS PROVIDED "AS IS" WITHOUT WARRANTY
//  OF ANY KIND, EITHER EXPRESSED OR IMPLIED, INCLUDING BUT NOT
//  LIMITED TO THE IMPLIED WARRANTIES OF MERCHANTABILITY AND
//  FITNESS FOR A PARTICULAR PURPOSE.
// 
//  ALL OTHER RIGHTS RESERVED

'use strict';

import _ from "../../libs/helper";
import { HTTPERROR_400, HTTPERROR_403 } from "../../shared/libs/constants";
import cosmosDb from "../../libs/cosmos-db";
import s3 from "../../libs/s3";
import { checkRecordPrivilege } from "../../shared/libs/authorization";
import { renderVideoPlayer } from './html-video-player';
import cloudFront from "../../libs/cloud-front";

export const deleteFile = async (event, context, callback) => {

    const caller = await _.checkCaller(event, context, callback);
    if (caller) return caller;

    const id = event.path && event.path.id ? event.path.id : _.getPropValueOfEvent(event, 'id');
    if (!_.isNonEmptyString(id)) return _.onError(callback, { event }, HTTPERROR_400, 'ERROR_API_MISSING_PARAMETERS', 'The parameter (id) is not provided.');


    const cx = await _.cx(event);

    try {

        //retrieve the document for security check
        //we will have to get the record first
        const result = await cosmosDb.queryRaw(cx, {
            query: 'SELECT * FROM c WHERE c._id = @id',
            parameters: [
                {
                    name: '@id',
                    value: id
                }
            ]
        });

        if (result.data.length == 0) return _.onSuccess(callback, cx, {});

        const record = result.data[0];

        if (record.entityName != 'Resource' || record.entityName == 'Resource' && !_.isNonEmptyString(record.entityType)) {
            return _.onError(callback, { event }, HTTPERROR_400, 'ERROR_API_NOTALLOWED',
                `The entity (${record.entityName}, ${record.entityType}) is not allowed to be deleted here.`);
        }

        if (!checkRecordPrivilege(cx.context, record, 'delete')) {
            throw HTTPERROR_403;
        }

        //delete the record first
        if (_.track) console.log({ record });

        await cosmosDb.deleteBase(cx, record, { skipSecurityCheck: true });

        //get the file path and delete from S3 first
        const fileName = record.fileName;

        if (_.track) console.log({ fileName: record.fileName });


        if (_.isNonEmptyString(fileName)) {
            //then delete file
            try {
                s3.delete(cx, record.entityType, fileName);
            }
            catch (s3Error) {

                //We will not throw a error to the caller, if the file does not exist or failed to delete in S3.
                if (_.isNonEmptyString(s3Error.statusMessag) && s3Error.statusMessage.indexOf('Entity with the specified id does not exist in the system') >= 0) {
                    console.log(`ERROR: File does not exist in S3 (fileName:${fileName}).`);
                }
                else {
                    console.log(`Failed to delete S3 file (fileName:${fileName}).`);
                }

            }

        }

        return _.onSuccess(callback, cx, record);

    }
    catch (error) {
        return _.onError(callback, cx, error, 'ERROR_API_DATA_DELETE', `Failed to delete data (id:${id}).`);
    }
}

export const uploadSetting = async (event, context, callback) => {

    const caller = await _.checkCaller(event, context, callback);
    if (caller) return caller;

    const type = _.getPropValueOfEvent(event, 'type');
    if (!_.isNonEmptyString(type)) return _.onError(callback, { event }, HTTPERROR_400, 'ERROR_API_MISSING_PARAMETERS', 'The parameter (type) is not provided.');

    const fileName = _.getPropValueOfEvent(event, 'fileName');
    if (!_.isNonEmptyString(fileName)) return _.onError(callback, { event }, HTTPERROR_400, 'ERROR_API_MISSING_PARAMETERS', 'The parameter (fileName) is not provided.');

    const cx = await _.cx(event);

    try {
        const result = await _.getUploadSetting(cx, type, fileName);
        return _.onSuccess(callback, cx, result);
    } catch (err) {
        return _.onError(callback, cx, err, 'ERROR_API_UTIL', 'failed to create s3 upload link');
    }
};

export const uploadFile = async (event, context, callback) => {

    const caller = await _.checkCaller(event, context, callback);
    if (caller) return caller;

    let data = _.getObjectValueOfEvent(event, 'data', null);
    if (!_.isObject(data)) return _.onError(callback, { event }, HTTPERROR_400, 'ERROR_API_MISSING_PARAMETERS_QUERY', 'The parameter (data) is not provided.');


    if (!_.isNonEmptyString(data.fileName)) {
        return _.onError(callback, { event }, HTTPERROR_400, 'ERROR_API_MISSING_PARAMETERS', 'The parameter (data.fileName) is not provided.');
    }


    if (!_.isNonEmptyString(data.entityName)) {
        return _.onError(callback, { event }, HTTPERROR_400, 'ERROR_API_MISSING_PARAMETERS', `The parameter (data.entityName) is not provided.`);
    }

    //some entities is not allowed to be updated here
    if (data.entityName !== 'Resource') {
        return _.onError(callback, { event }, HTTPERROR_400, 'ERROR_API_NOTALLOWED', `The entity (${data.entityName}) is not allowed to be created/updated here.`);
    }

    if (!_.isNonEmptyString(data.entityType)) {
        return _.onError(callback, { event }, HTTPERROR_400, 'ERROR_API_MISSING_PARAMETERS', `The parameter (data.entityType) is not provided.`);
    }

    const fileNameInfo = data.fileName.split('/');
    data.name = fileNameInfo[fileNameInfo.length - 1];

    const cx = await _.cx(event);

    try {

        //we will try to retrieve the record, because it may be overwriting an existing resource
        const result = await _.processDataForUpsert(cx, data);

        data = result.data;
        const existingData = result.existingData;

        //if the title is not modified manually
        //We will update it automatically
        if (!_.isObject(existingData) && !_.isNonEmptyString(data.title) || _.isObject(existingData) && data.title == existingData.title) {
            data.title = data.name;
        }

        if (_.isObject(existingData)) {
            if (!checkRecordPrivilege(cx.context, existingData, 'update')) {
                throw new Error(`The user has no permission to update the record(${data.id}).`);
            }

            data = await cosmosDb.update(cx, data, true);
        }
        else {
            data = await cosmosDb.create(cx, data, false);
        }

        if (_.track) console.log({ data: JSON.stringify(data) });

        data.token = await _.createRecordToken(cx, data);

        return _.onSuccess(callback, cx, data);
    }
    catch (error) {
        return _.onError(callback, cx, error, 'ERROR_API_DATA_CREATE', `Failed to create data(id: ${data.id})`);
    }
}

const getExpireInSeconds = () => {
    const expiredDate = new Date();
    expiredDate.setHours(expiredDate.getHours() + 2); //2hrs
    expiredDate.setMinutes(59);
    expiredDate.setSeconds(59);

    const now = new Date();
    return Math.round((expiredDate - now) / 1000);
}

const retrieveFileInternal = async (cx, id, skipSecurityCheck) => {

    let result = { id };

    //by default, we use absolute expires, it will be always the duration (in seconds) bewtween now and the end of the next hour.
    //This will make the expires between 1-2 hours, the benefit of this is the generate signed URL are always same bewteen now and the end of the next hour.
    //Therefore the file or photo can be cached on browser instead of reload each time UI is refreshed.

    const expireInSeconds = getExpireInSeconds();
    const recordToken = _.getRecordToken(cx.event);

    if (!_.isNonEmptyString(id)) {
        throw new Error(`id is not provided`);
    }

    //id will be in the formats below
    //{type}.{id}
    //{type}.{id}.{photoSize}
    //Valid photo size: "120x90" , "240x180" , "480x360" , "1200x900"
    const idInfo = result.id.split(".");

    let type = idInfo[0].toLowerCase();
    if (type != "photo" && type != "audio" && type != "document" && type != "video" && type != "video-cover" && type != "video-stream") {
        throw new Error(`Wrong type ${type}`);
    }

    if (idInfo.length == 1 || (idInfo.length > 1 && !_.isGuid(idInfo[1]))) {
        throw new Error(`Wrong id format ${idInfo}`);
    }

    result.id = idInfo[1];

    //try to get the signed url from the cache
    const url = _.getDynamoDbCache(id);
    const goodRecordToken = !_.isNonEmptyString(recordToken) ? false : (await _.checkRecordToken(cx, recordToken, result.id));

    if (_.isNonEmptyString(url) && (skipSecurityCheck || goodRecordToken)) {
        result.location = url;
        return result;
    }

    const file = await await _.cosmosDbRetrieve(cx, result.id, true);
    if (!file) throw new Error(`File does not exist (id: ${result.id})`);

    if (!skipSecurityCheck) {

        if (_.isNonEmptyString(recordToken) && !goodRecordToken) {
            throw new Error(`Token permission is denied.`);
        }
        else {
            if (!_.isNonEmptyString(recordToken) && !checkRecordPrivilege(cx.context, file, "read")) {
                throw new Error(`Read permission is denied.`);
            }
        }
    }

    let fileName = file.fileName;

    if (!_.isNonEmptyString(fileName)) {
        throw new Error(`The file name does not exist.`);
    }

    let entityType = file.entityType;
    switch (entityType) {
        case "Photo": {
            if (idInfo.length > 2) {
                //it means the 3rd segment is size
                //we only support valid sizes
                const photoSize = idInfo[2];
                if (photoSize === "120x90" || photoSize === "240x180" || photoSize === "480x360" || photoSize === "1200x900") {
                    result.photoSize = photoSize;
                }
            }

            const photoSizes = file.photoSizes;
            if (photoSizes != null && photoSizes.indexOf(result.photoSize) >= 0) {
                fileName = fileName + ".TN." + result.photoSize + ".jpg";
            }

            result.location = await s3.signedUrl(cx, entityType, fileName, expireInSeconds);
            break;
        }
        case "Video": {
            switch (type) {
                case "video-cover": {
                    let photoSize = null;
                    if (idInfo.length > 2) {
                        //it means the 3rd segment is size
                        //we only support valid sizes
                        photoSize = idInfo[2];
                        if (photoSize === "120x90" || photoSize === "240x180" || photoSize === "480x360" || photoSize === "1200x900") {
                            result.photoSize = photoSize;
                        } else {
                            photoSize = null;
                        }
                    }

                    const cloudNameInfo = fileName.split(".");
                    fileName = cloudNameInfo.slice(0, cloudNameInfo.length - 1).join(".");
                    fileName = photoSize === null ? `${fileName}-00001.png` : `${fileName}-00001.png.TN.${result.photoSize}.jpg`;

                    entityType = `${entityType}-m3u8`;

                    if (await s3.checkFileExistence(cx, entityType, fileName)) {
                        result.location = await s3.signedUrl(cx, entityType, fileName, expireInSeconds);
                    }
                    else {
                        return _.assign({ type }, result, { location: `file-not-exist.error` });
                    }

                    break;
                }
                case "video-stream":
                    {
                        const folderNameInfo = fileName.split("/");
                        const folderName = folderNameInfo.slice(0, folderNameInfo.length - 1).join("/");

                        entityType = `${entityType}-m3u8`;

                        result = _.assign({}, result, await cloudFront.signedCookieForFolder(cx, await _.getSecretValue('CLOUDFRONT_M3U8_DOMAIN', cx.context.solutionId), folderName, "index.m3u8", expireInSeconds));
                        break;
                    }
                default: {
                    result.location = await s3.signedUrl(cx, entityType, fileName, expireInSeconds);
                }
            }

            break;
        }
        case "Audio": {
            result.location = await s3.signedUrl(cx, entityType, fileName, expireInSeconds);
            break;
        }
        default: {
            throw new Error(`Wrong entitytype ${entityType}`);
        }
    }

    _.setDynamoDbCache(id, result.location, parseInt(expireInSeconds / 60 - 30)); //it will expire 30 mins before the url expires

    result.expireInSeconds = expireInSeconds;
    return result;
};

export const retrieveFile = async (event, context, callback) => {

    const caller = await _.checkCaller(event, context, callback, { allowAnonymous: true, apiName: 'retrieveFile', apiPoints: 1 });
    if (caller) return caller;

    const cx = await _.cx(event);

    try {
        return await retrieveFileInternal(cx, event.path.id);
    }
    catch (error) {
        console.error(error);
        return { location: `https://${cx.context.domain}/images/error.jpg` };
    }
}

export const videoPlayer = async (event, context, callback) => {

    const caller = await _.checkCaller(event, context, callback, { allowAnonymous: true, apiName: 'videoPlayer', apiPoints: 1 });
    if (caller) return caller;

    const cx = await _.cx(event);

    let mp4 = { location: '' };
    let coverPhoto = { location: '' };
    let m3u8 = { location: '' };

    try {
        mp4 = await retrieveFileInternal(cx, `video.${event.path.id}`, true);
    }
    catch (error) {
        console.error(error, { error: 'ERROR_API_WRONG_FILE', detail: `Video MP4` });
    }

    if (_.isNonEmptyString(mp4.location)) {
        try {
            coverPhoto = await retrieveFileInternal(cx, `video-cover.${event.path.id}`, true);
        }
        catch (error) {
            console.error(error, { error: 'ERROR_API_WRONG_FILE', detail: `Cover Photo` });
        }
    }

    if (_.isNonEmptyString(mp4.location)) {
        try {
            m3u8 = await retrieveFileInternal(cx, `video-stream.${event.path.id}`, true);
        }
        catch (error) {
            console.error(error, { error: 'ERROR_API_WRONG_FILE', detail: `Video Stream M3U8` });
        }
    }


    const settings = {
        platformUrl: `https://${cx.context.solution.platform.domain}`,
        protocol: _.getPropValueOfEvent(event, 'protocol', 'https'),
        domain: _.getPropValueOfEvent(event, 'domain', cx.context.domain),
        m3u8Location: m3u8.location,
        mp4Location: mp4.location,
        coverPhotoLocation: coverPhoto.location,
        start: _.getPropValueOfEvent(event, 'start'),
        jump: _.getFloatValueOfEvent(event, 'jump', 0),
        track: _.getBooleanValueOfEvent(event, 'track', _.track)
    };

    const result = {
        html: renderVideoPlayer(settings)
    }

    result.headers = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Credentials": true }; //not sure if needed
    result.cookie1 = `CloudFront-Policy=${m3u8.policy}; Domain=${process.env.API_DOMAIN}; Path=/; Max-Age=600; SameSite=None; Secure;`;
    result.cookie2 = `CloudFront-Signature=${m3u8.signature}; Domain=${process.env.API_DOMAIN}; Path=/; Max-Age=600; SameSite=None; Secure;`;
    result.cookie3 = `CloudFront-Key-Pair-Id=${m3u8.keyPairId}; Domain=${process.env.API_DOMAIN}; Path=/; Max-Age=600; SameSite=None; Secure;`;

    return result;
}

export const avatar = async (event, context, callback) => {

    const caller = await _.checkCaller(event, context, callback, { allowAnonymous: true, apiName: 'avatar', apiPoints: 1 });
    if (caller) return caller;

    const cx = await _.cx(event);

    let location = `https://${cx.context.domain}${cx.context.solution.default.userPhoto}`;

    try {
        const userId = event.path.id;
        const params = { TableName: `profile`, Key: { id: `user.${userId}` } }; //`${process.env.PREFIX}-profile` should change 
        params.AttributesToGet = ['avatar'];
        const record = (await _.dynamoDb.get(params).promise()).Item;
        if (record && _.isNonEmptyString(record['avatar'])) location = record['avatar'];
    }
    catch (error) {
        console.error(error);
    }

    return { location };
}

// const codeEditor = async (event) => {

//     let result = { html: "<html><body/></html>" };
//     const siteDomainName = app.getQueryValue(event.query, 'siteDomainName');

//     if (_.track) console.log(siteDomainName);

//     if (_.isNonEmptyString(siteDomainName)) {

//         let track = _.track;
//         if (app.getQueryValue(event.query, 'track') == 'true') track = true;

//         const settings = {
//             track, siteDomainName,
//             callerDomainName: app.getQueryValue(event.query, 'callerDomainName', ''),
//             theme: app.getQueryValue(event.query, 'theme', 'chrome').toLowerCase(),
//             disabled: `${app.getQueryValue(event.query, 'disabled', false)}`,
//             language: app.getQueryValue(event.query, 'language', 'json').toLowerCase(),
//             activeLine: `${app.getQueryValue(event.query, 'activeLine', true)}`,
//             tabSize: app.getQueryValue(event.query, 'tabSize', '4').toLowerCase(),
//             iframeId: app.getQueryValue(event.query, 'iframeId'),
//             printMargin: `${app.getQueryValue(event.query, 'printMargin', false)}`,
//             wrapLine: `${app.getQueryValue(event.query, 'wrapLine', false)}`,
//         }

//         if (_.track) console.log(settings);

//         if (_.isNonEmptyString(settings.iframeId)) {
//             result = {
//                 html: renderCodeEditor(settings, process.env)
//             };
//         }
//     }

//     return result;
// }

