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


import {
    HTTPERROR_500, onSuccess, onError, LambdaResponse,
    CheckCallerResult, CheckCallerSettings, checkCaller,
    getPropValueOfEvent, getObjectValueOfEvent, HTTPERROR_400, ERROR_PARAMETER_MISSING,
    getBooleanValueOfEvent,
    getIntValueOfEvent
} from 'douhub-helper-lambda';
import {isNil, isNumber} from 'lodash';
import { _track, isNonEmptyString, getFileType, getContentType } from 'douhub-helper-util';
import { s3SignedUrl, cloudFrontSignedUrl, RESOURCE_PREFIX} from 'douhub-helper-service';


export const uploadSetting = async (event) => {

    const apiName = 'file.uploadSetting';
    
    try {

        const caller: CheckCallerResult = await checkCaller(event, { apiName });

        if (caller.type == 'STOP') return onSuccess(caller);
        if (caller.type == 'ERROR') throw caller.error;

        const organizationId = caller?.context.organizationId;
        
        const fileName = getPropValueOfEvent(event, 'fileName');
        if (!isNonEmptyString(fileName)) {
            throw {
                ...HTTPERROR_400,
                type: ERROR_PARAMETER_MISSING,
                source: apiName,
                detail: {
                    reason: 'The fileName does not exist.'
                }
            }
        }

        const entityName = getPropValueOfEvent(event, 'entityName');
        if (!isNonEmptyString(entityName)) {
            throw {
                ...HTTPERROR_400,
                type: ERROR_PARAMETER_MISSING,
                source: apiName,
                detail: {
                    reason: 'The entityName does not exist.'
                }
            }
        }

        const attributeName = getPropValueOfEvent(event, 'attributeName');
        if (!isNonEmptyString(attributeName)) {
            throw {
                ...HTTPERROR_400,
                type: ERROR_PARAMETER_MISSING,
                source: apiName,
                detail: {
                    reason: 'The attributeName does not exist.'
                }
            }
        }

        const recordId = getPropValueOfEvent(event, 'recordId');
        if (!isNonEmptyString(recordId)) {
            throw {
                ...HTTPERROR_400,
                type: ERROR_PARAMETER_MISSING,
                source: apiName,
                detail: {
                    reason: 'The recordId does not exist.'
                }
            }
        }

        const s3FileName = `${organizationId}/${entityName}/${recordId}/${attributeName}/${fileName}`;

        const acl = getPropValueOfEvent(event, 'acl', 'public-read-write');
        const expires = getIntValueOfEvent(event, 'expires', 3600);
        const type = getFileType(fileName);
        const contentType = getContentType(fileName);
        const s3BucketName = `${RESOURCE_PREFIX}-${type.toLowerCase()}`;
        const url = await s3SignedUrl( s3BucketName, s3FileName, acl, expires);

        return onSuccess({s3BucketName, s3FileName, url, type, contentType, expires });
    }
    catch (error:any) {
        if (_track) console.error({ error });
        throw new Error(JSON.stringify(onError({
            ...HTTPERROR_500,
            source: apiName
        }, error)));
    }
};

export const getCloudFrontSignedUrl = async (event) => {

    const apiName = 'file.cloudFrontSignedUrl';
    
    try {

        const caller: CheckCallerResult = await checkCaller(event, { apiName });

        if (caller.type == 'STOP') return onSuccess(caller);
        if (caller.type == 'ERROR') throw caller.error;

        const url = getPropValueOfEvent(event, 'url');
        if (!isNonEmptyString(url)) {
            throw {
                ...HTTPERROR_400,
                type: ERROR_PARAMETER_MISSING,
                source: apiName,
                detail: {
                    reason: 'The url does not exist.'
                }
            }
        }

        const EXPIRES_50YERS = 50 * 365 * 24 * 60 * 60;
        const expires = getIntValueOfEvent(event, 'expires', EXPIRES_50YERS);
        // const s3BucketName = `https://${RESOURCE_PREFIX}-${type.toLowerCase()}/${s3FileName}`;
        const signedUrl = await cloudFrontSignedUrl( url, !isNil(expires)?expires:EXPIRES_50YERS);

        return onSuccess({url, signedUrl, expires });
    }
    catch (error:any) {
        if (_track) console.error({ error });
        throw new Error(JSON.stringify(onError({
            ...HTTPERROR_500,
            source: apiName
        }, error)));
    }
};


// export const deleteFile = async (event, context, callback) => {

//     const caller = await checkCaller(event, context, callback);
//     if (caller) return caller;

//     const id = event.path && event.path.id ? event.path.id : getPropValueOfEvent(event, 'id');
//     if (!isNonEmptyString(id)) return onError(callback, { event }, HTTPERROR_400, 'ERROR_API_MISSING_PARAMETERS', 'The parameter (id) is not provided.');


//     const cx = await cx(event);

//     try {

//         //retrieve the document for security check
//         //we will have to get the record first
//         const result = await cosmosDb.queryRaw(cx, {
//             query: 'SELECT * FROM c WHERE c._id = @id',
//             parameters: [
//                 {
//                     name: '@id',
//                     value: id
//                 }
//             ]
//         });

//         if (result.data.length == 0) return onSuccess(callback, cx, {});

//         const record = result.data[0];

//         if (record.entityName != 'Resource' || record.entityName == 'Resource' && !isNonEmptyString(record.entityType)) {
//             return onError(callback, { event }, HTTPERROR_400, 'ERROR_API_NOTALLOWED',
//                 `The entity (${record.entityName}, ${record.entityType}) is not allowed to be deleted here.`);
//         }

//         if (!checkRecordPrivilege(cx.context, record, 'delete')) {
//             throw HTTPERROR_403;
//         }

//         //delete the record first
//         if (_track) console.log({ record });

//         await cosmosDb.deleteBase(cx, record, { skipSecurityCheck: true });

//         //get the file path and delete from S3 first
//         const fileName = record.fileName;

//         if (_track) console.log({ fileName: record.fileName });


//         if (isNonEmptyString(fileName)) {
//             //then delete file
//             try {
//                 s3.delete(cx, record.entityType, fileName);
//             }
//             catch (s3Error) {

//                 //We will not throw a error to the caller, if the file does not exist or failed to delete in S3.
//                 if (isNonEmptyString(s3Error.statusMessag) && s3Error.statusMessage.indexOf('Entity with the specified id does not exist in the system') >= 0) {
//                     console.log(`ERROR: File does not exist in S3 (fileName:${fileName}).`);
//                 }
//                 else {
//                     console.log(`Failed to delete S3 file (fileName:${fileName}).`);
//                 }

//             }

//         }

//         return onSuccess(callback, cx, record);

//     }
//     catch (error) {
//         return onError(callback, cx, error, 'ERROR_API_DATA_DELETE', `Failed to delete data (id:${id}).`);
//     }
// }


// export const uploadFile = async (event, context, callback) => {

//     const caller = await checkCaller(event, context, callback);
//     if (caller) return caller;

//     let data = getObjectValueOfEvent(event, 'data', null);
//     if (!isObject(data)) return onError(callback, { event }, HTTPERROR_400, 'ERROR_API_MISSING_PARAMETERS_QUERY', 'The parameter (data) is not provided.');


//     if (!isNonEmptyString(data.fileName)) {
//         return onError(callback, { event }, HTTPERROR_400, 'ERROR_API_MISSING_PARAMETERS', 'The parameter (data.fileName) is not provided.');
//     }


//     if (!isNonEmptyString(data.entityName)) {
//         return onError(callback, { event }, HTTPERROR_400, 'ERROR_API_MISSING_PARAMETERS', `The parameter (data.entityName) is not provided.`);
//     }

//     //some entities is not allowed to be updated here
//     if (data.entityName !== 'Resource') {
//         return onError(callback, { event }, HTTPERROR_400, 'ERROR_API_NOTALLOWED', `The entity (${data.entityName}) is not allowed to be created/updated here.`);
//     }

//     if (!isNonEmptyString(data.entityType)) {
//         return onError(callback, { event }, HTTPERROR_400, 'ERROR_API_MISSING_PARAMETERS', `The parameter (data.entityType) is not provided.`);
//     }

//     const fileNameInfo = data.fileName.split('/');
//     data.name = fileNameInfo[fileNameInfo.length - 1];

//     const cx = await cx(event);

//     try {

//         //we will try to retrieve the record, because it may be overwriting an existing resource
//         const result = await processDataForUpsert(cx, data);

//         data = result.data;
//         const existingData = result.existingData;

//         //if the title is not modified manually
//         //We will update it automatically
//         if (!isObject(existingData) && !isNonEmptyString(data.title) || isObject(existingData) && data.title == existingData.title) {
//             data.title = data.name;
//         }

//         if (isObject(existingData)) {
//             if (!checkRecordPrivilege(cx.context, existingData, 'update')) {
//                 throw new Error(`The user has no permission to update the record(${data.id}).`);
//             }

//             data = await cosmosDb.update(cx, data, true);
//         }
//         else {
//             data = await cosmosDb.create(cx, data, false);
//         }

//         if (_track) console.log({ data: JSON.stringify(data) });

//         data.token = await createRecordToken(cx, data);

//         return onSuccess(callback, cx, data);
//     }
//     catch (error) {
//         return onError(callback, cx, error, 'ERROR_API_DATA_CREATE', `Failed to create data(id: ${data.id})`);
//     }
// }


// const retrieveFileInternal = async (cx, id, skipSecurityCheck) => {

//     let result = { id };

//     //by default, we use absolute expires, it will be always the duration (in seconds) bewtween now and the end of the next hour.
//     //This will make the expires between 1-2 hours, the benefit of this is the generate signed URL are always same bewteen now and the end of the next hour.
//     //Therefore the file or photo can be cached on browser instead of reload each time UI is refreshed.

//     const expireInSeconds = getExpireInSeconds();
//     const recordToken = getRecordToken(cx.event);

//     if (!isNonEmptyString(id)) {
//         throw new Error(`id is not provided`);
//     }

//     //id will be in the formats below
//     //{type}.{id}
//     //{type}.{id}.{photoSize}
//     //Valid photo size: "120x90" , "240x180" , "480x360" , "1200x900"
//     const idInfo = result.id.split(".");

//     let type = idInfo[0].toLowerCase();
//     if (type != "photo" && type != "audio" && type != "document" && type != "video" && type != "video-cover" && type != "video-stream") {
//         throw new Error(`Wrong type ${type}`);
//     }

//     if (idInfo.length == 1 || (idInfo.length > 1 && !isGuid(idInfo[1]))) {
//         throw new Error(`Wrong id format ${idInfo}`);
//     }

//     result.id = idInfo[1];

//     //try to get the signed url from the cache
//     const url = getDynamoDbCache(id);
//     const goodRecordToken = !isNonEmptyString(recordToken) ? false : (await checkRecordToken(cx, recordToken, result.id));

//     if (isNonEmptyString(url) && (skipSecurityCheck || goodRecordToken)) {
//         result.location = url;
//         return result;
//     }

//     const file = await await cosmosDbRetrieve(cx, result.id, true);
//     if (!file) throw new Error(`File does not exist (id: ${result.id})`);

//     if (!skipSecurityCheck) {

//         if (isNonEmptyString(recordToken) && !goodRecordToken) {
//             throw new Error(`Token permission is denied.`);
//         }
//         else {
//             if (!isNonEmptyString(recordToken) && !checkRecordPrivilege(cx.context, file, "read")) {
//                 throw new Error(`Read permission is denied.`);
//             }
//         }
//     }

//     let fileName = file.fileName;

//     if (!isNonEmptyString(fileName)) {
//         throw new Error(`The file name does not exist.`);
//     }

//     let entityType = file.entityType;
//     switch (entityType) {
//         case "Photo": {
//             if (idInfo.length > 2) {
//                 //it means the 3rd segment is size
//                 //we only support valid sizes
//                 const photoSize = idInfo[2];
//                 if (photoSize === "120x90" || photoSize === "240x180" || photoSize === "480x360" || photoSize === "1200x900") {
//                     result.photoSize = photoSize;
//                 }
//             }

//             const photoSizes = file.photoSizes;
//             if (photoSizes != null && photoSizes.indexOf(result.photoSize) >= 0) {
//                 fileName = fileName + ".TN." + result.photoSize + ".jpg";
//             }

//             result.location = await s3.signedUrl(cx, entityType, fileName, expireInSeconds);
//             break;
//         }
//         case "Video": {
//             switch (type) {
//                 case "video-cover": {
//                     let photoSize = null;
//                     if (idInfo.length > 2) {
//                         //it means the 3rd segment is size
//                         //we only support valid sizes
//                         photoSize = idInfo[2];
//                         if (photoSize === "120x90" || photoSize === "240x180" || photoSize === "480x360" || photoSize === "1200x900") {
//                             result.photoSize = photoSize;
//                         } else {
//                             photoSize = null;
//                         }
//                     }

//                     const cloudNameInfo = fileName.split(".");
//                     fileName = cloudNameInfo.slice(0, cloudNameInfo.length - 1).join(".");
//                     fileName = photoSize === null ? `${fileName}-00001.png` : `${fileName}-00001.png.TN.${result.photoSize}.jpg`;

//                     entityType = `${entityType}-m3u8`;

//                     if (await s3.checkFileExistence(cx, entityType, fileName)) {
//                         result.location = await s3.signedUrl(cx, entityType, fileName, expireInSeconds);
//                     }
//                     else {
//                         return assign({ type }, result, { location: `file-not-exist.error` });
//                     }

//                     break;
//                 }
//                 case "video-stream":
//                     {
//                         const folderNameInfo = fileName.split("/");
//                         const folderName = folderNameInfo.slice(0, folderNameInfo.length - 1).join("/");

//                         entityType = `${entityType}-m3u8`;

//                         result = assign({}, result, await cloudFront.signedCookieForFolder(cx, await getSecretValue('CLOUDFRONT_M3U8_DOMAIN', cx.context.solutionId), folderName, "index.m3u8", expireInSeconds));
//                         break;
//                     }
//                 default: {
//                     result.location = await s3.signedUrl(cx, entityType, fileName, expireInSeconds);
//                 }
//             }

//             break;
//         }
//         case "Audio": {
//             result.location = await s3.signedUrl(cx, entityType, fileName, expireInSeconds);
//             break;
//         }
//         default: {
//             throw new Error(`Wrong entitytype ${entityType}`);
//         }
//     }

//     setDynamoDbCache(id, result.location, parseInt(expireInSeconds / 60 - 30)); //it will expire 30 mins before the url expires

//     result.expireInSeconds = expireInSeconds;
//     return result;
// };

// export const retrieveFile = async (event, context, callback) => {

//     const caller = await checkCaller(event, context, callback, { allowAnonymous: true, apiName: 'retrieveFile', apiPoints: 1 });
//     if (caller) return caller;

//     const cx = await cx(event);

//     try {
//         return await retrieveFileInternal(cx, event.path.id);
//     }
//     catch (error) {
//         console.error(error);
//         return { location: `https://${cx.context.domain}/images/error.jpg` };
//     }
// }

// export const videoPlayer = async (event, context, callback) => {

//     const caller = await checkCaller(event, context, callback, { allowAnonymous: true, apiName: 'videoPlayer', apiPoints: 1 });
//     if (caller) return caller;

//     const cx = await cx(event);

//     let mp4 = { location: '' };
//     let coverPhoto = { location: '' };
//     let m3u8 = { location: '' };

//     try {
//         mp4 = await retrieveFileInternal(cx, `video.${event.path.id}`, true);
//     }
//     catch (error) {
//         console.error(error, { error: 'ERROR_API_WRONG_FILE', detail: `Video MP4` });
//     }

//     if (isNonEmptyString(mp4.location)) {
//         try {
//             coverPhoto = await retrieveFileInternal(cx, `video-cover.${event.path.id}`, true);
//         }
//         catch (error) {
//             console.error(error, { error: 'ERROR_API_WRONG_FILE', detail: `Cover Photo` });
//         }
//     }

//     if (isNonEmptyString(mp4.location)) {
//         try {
//             m3u8 = await retrieveFileInternal(cx, `video-stream.${event.path.id}`, true);
//         }
//         catch (error) {
//             console.error(error, { error: 'ERROR_API_WRONG_FILE', detail: `Video Stream M3U8` });
//         }
//     }


//     const settings = {
//         platformUrl: `https://${cx.context.solution.platform.domain}`,
//         protocol: getPropValueOfEvent(event, 'protocol', 'https'),
//         domain: getPropValueOfEvent(event, 'domain', cx.context.domain),
//         m3u8Location: m3u8.location,
//         mp4Location: mp4.location,
//         coverPhotoLocation: coverPhoto.location,
//         start: getPropValueOfEvent(event, 'start'),
//         jump: getFloatValueOfEvent(event, 'jump', 0),
//         track: getBooleanValueOfEvent(event, 'track', _track)
//     };

//     const result = {
//         html: renderVideoPlayer(settings)
//     }

//     result.headers = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Credentials": true }; //not sure if needed
//     result.cookie1 = `CloudFront-Policy=${m3u8.policy}; Domain=${process.env.API_DOMAIN}; Path=/; Max-Age=600; SameSite=None; Secure;`;
//     result.cookie2 = `CloudFront-Signature=${m3u8.signature}; Domain=${process.env.API_DOMAIN}; Path=/; Max-Age=600; SameSite=None; Secure;`;
//     result.cookie3 = `CloudFront-Key-Pair-Id=${m3u8.keyPairId}; Domain=${process.env.API_DOMAIN}; Path=/; Max-Age=600; SameSite=None; Secure;`;

//     return result;
// }

// export const avatar = async (event, context, callback) => {

//     const caller = await checkCaller(event, context, callback, { allowAnonymous: true, apiName: 'avatar', apiPoints: 1 });
//     if (caller) return caller;

//     const cx = await cx(event);

//     let location = `https://${cx.context.domain}${cx.context.solution.default.userPhoto}`;

//     try {
//         const userId = event.path.id;
//         const params = { TableName: `profile`, Key: { id: `user.${userId}` } }; //`${process.env.PREFIX}-profile` should change 
//         params.AttributesToGet = ['avatar'];
//         const record = (await dynamoDb.get(params).promise()).Item;
//         if (record && isNonEmptyString(record['avatar'])) location = record['avatar'];
//     }
//     catch (error) {
//         console.error(error);
//     }

//     return { location };
// }

// // const codeEditor = async (event) => {

// //     let result = { html: "<html><body/></html>" };
// //     const siteDomainName = app.getQueryValue(event.query, 'siteDomainName');

// //     if (_track) console.log(siteDomainName);

// //     if (isNonEmptyString(siteDomainName)) {

// //         let track = _track;
// //         if (app.getQueryValue(event.query, 'track') == 'true') track = true;

// //         const settings = {
// //             track, siteDomainName,
// //             callerDomainName: app.getQueryValue(event.query, 'callerDomainName', ''),
// //             theme: app.getQueryValue(event.query, 'theme', 'chrome').toLowerCase(),
// //             disabled: `${app.getQueryValue(event.query, 'disabled', false)}`,
// //             language: app.getQueryValue(event.query, 'language', 'json').toLowerCase(),
// //             activeLine: `${app.getQueryValue(event.query, 'activeLine', true)}`,
// //             tabSize: app.getQueryValue(event.query, 'tabSize', '4').toLowerCase(),
// //             iframeId: app.getQueryValue(event.query, 'iframeId'),
// //             printMargin: `${app.getQueryValue(event.query, 'printMargin', false)}`,
// //             wrapLine: `${app.getQueryValue(event.query, 'wrapLine', false)}`,
// //         }

// //         if (_track) console.log(settings);

// //         if (isNonEmptyString(settings.iframeId)) {
// //             result = {
// //                 html: renderCodeEditor(settings, process.env)
// //             };
// //         }
// //     }

// //     return result;
// // }

