
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

import _ from '../../libs/helper';

const HTML =
    `
        <html>
        <head>
            <link rel="shortcut icon" href="[PH.PLATFORMURL]/core/favicon.ico" />
            <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/flowplayer/7.2.7/skin/skin.min.css">
            <style type="text/css">
                .fp-player .fp-context-menu {
                    position: fixed !important;
                    top: -100000px !important
                }

                .fp-player>a {
                    position: fixed !important;
                    top: -100000px !important
                }

                .flowplayer {
                    border-radius: 0 !important
                }

                .fp-share {
                    display: none
                }
            </style>
        </head>

        <body style="background-color:#000;padding:0;margin:0" onclick="">
        
            <div id="player" style="background-color:#000;width:100%;height:100%"></div>
            
            <script src="[PH.PLATFORMURL]/core/js/jquery.slim.min.js"></script>
            <script src="[PH.PLATFORMURL]/core/flowplayer/flowplayer.min.js"></script>
            <script src="[PH.PLATFORMURL]/core/flowplayer/flowplayer.hlsjs.min.js"></script>

            <script>
                
                const m3u8Src = "[PH.M3U8]";
                const mp4Src = "[PH.MP4]";
                const coverSrc = "[PH.COVER]";

                let jump = [PH.JUMP];
                let start = '[PH.START]';
                const track = [PH.TRACK];

                const autoStart = jump>0 || start=='autostart';

                let curFileName = null;

                const origOpen = XMLHttpRequest.prototype.open;
                const iframeId = "[PH.IFRAMEID]";
                
                function postMessageToParent(message)
                {
                    if (track) console.log({postMessageToParent:message});
                    parent.postMessage(message, "[PH.PROTOCOL]://[PH.DOMAIN]");
                }

                XMLHttpRequest.prototype.open = function(method, url) {
                    this.addEventListener('load', function() {
                        curFileName = url;
                    });
            
                    this.addEventListener('error', function(e) {
                        if (track) console.log({event:"error", e});
                    });
                    origOpen.apply(this, arguments);
                };

                function messageHandler(message)
                {
                    const data = message.data;
                    if (track) console.log({messageFromCaller: message});
                    let result = null;
                    if ($.isPlainObject(data) && data.source=='douhub') 
                    {
                        switch(data.action)
                        {
                            case 'pause':
                            {
                                result = pause();
                                break;
                            }
                            case 'play':
                            {
                                result = play();
                                break;
                            }
                            case 'seek':
                            {
                                result = seek(data.jumpNumber,data.jumpStart);
                                break;
                            }
                            case 'enable':
                            {
                                result = enable();
                                break;
                            }
                            case 'disable':
                            {
                                result = disable();
                                break;
                            }
                            case 'mute':
                            {
                                result = mute();
                                break;
                            }
                            case 'unmute':
                            {
                                result = unmute();
                                break;
                            }
                        }
                    }

                    // if (result)
                    // {
                    //     postMessageToParent({result, message});
                    // }
                }

                if (window.addEventListener) {
                    window.addEventListener("message", messageHandler);
                } else {
                    window.attachEvent("onmessage", messageHandler);
                }


                //https://releases.flowplayer.org/7.2.7/flowplayer.min.js
                
                //Document: https://flowplayer.com/help/player/flowplayer-7/setup#hls
                //NOTE: flowplayer.hlsjs.min.js comes from https://cdn.jsdelivr.net/npm/hls.js@0.11.0/dist/hls.light.min.js"
                //Only 0.11.0 works

                //releases.flowplayer.org/7.2.7/skin/skin.css
        
                

                function getVideo(action)
                {
                    const video = window.player && window.player.video?window.player.video: {time: 0};

                    video.curFileName = curFileName;
                    video.m3u8Src = m3u8Src;
                    video.mp4Src = mp4Src;
                    video.coverSrc = coverSrc;
                    video.action = action;
                    video.playing = window.player.playing;
                    video.disabled = window.player.disabled;
                    video.paused = window.player.paused;
                    video.muted = window.player.muted;
                    if (!video.time) video.time = 0;
                    delete video.hlsjs;
                    return video;
                }

                function seek(jumpNum, jumpStart)
                {
                    jump = jumpNum;
                    if (jumpStart) start = 'jumpstart'; else start = '';
                    if (window.player && window.player.seek)  
                    {
                        window.player.seek(jumpNum);
                    }
                    return getVideo('seek');
                }

                function pause()
                {
                    if (window.player && window.player.pause)  
                    {
                        window.player.pause();
                    }
                    return getVideo('pause');
                }

                function play()
                {
                    if (window.player && window.player.play)
                    {
                        window.player.play();
                        document.getElementsByClassName("fp-ui")[0].click();
                    }
                    else
                    {
                        setTimeout(play, 100);
                    }
                    return getVideo('play');
                }

                function enable()
                {
                    if (window.player && window.player.disable)
                    {
                        window.player.disable(false);
                    }
                    return getVideo('enable');
                }

                function disable()
                {
                    if (window.player && window.player.disable)
                    {
                        window.player.disable(true);
                    }
                    return getVideo('disable');
                }

                function mute()
                {
                    if (window.player && window.player.mute)
                    {
                        window.player.mute(true);
                    }
                    return getVideo('mute');
                }

                function unmute()
                {
                    if (window.player && window.player.mute)
                    {
                        window.player.mute(false);
                    }
                    return getVideo('unmute');
                }

                const sources = [];

                if (m3u8Src.length>0) sources.push({ type: "application/x-mpegurl", src: m3u8Src });
                if (mp4Src.length>0) sources.push({ type: "video/mp4", src: mp4Src });

            
                const settings = {
                    mutedAutoplay: false,
                    autoplay: autoStart,
                    splash: true,
                    aspectRatio: "16:9",
                    clip: {
                        //xhr.withCredentials = true; ensures the cookie will be submitted in the request
                        hlsjs: {safari: true, xhrSetup: function (xhr) { xhr.withCredentials = true; } },
                        sources
                    }
                }

                if (coverSrc.length>0) settings.poster = coverSrc;

                window.onload = function () {

                    window.player = flowplayer("#player", settings);

                    window.player.on("load", function (e) {
                        const message = {action:"load", video: getVideo('load')};
                        if (track) console.log(message);
                        postMessageToParent(message);
                    });
                
                    window.player.on("ready", function (e) 
                    {
                        if ($(".fp-fullscreen").length==0)
                        {
                            $(".fp-controls").append('<a class="fp-icon fp-fullscreen"></a>');
                            $(".fp-fullscreen").click(function(){
                                window.open(window.location);
                            })
                        }
                       
                        const message = {action:"ready", video: getVideo('ready')};
                        if (track) console.log(message);
                        postMessageToParent(message);
                    });

                    window.player.on("progress", function (e,o,timeStamp) {

                        const message = {action:"progress", video: getVideo('progress')};
                        if (track) console.log(message);

                        if (jump>0)
                        {
                            window.player.seek(jump);
                            jump=-1;
                            if (start!='jumpstart') setTimeout(pause,100);
                        }

                        postMessageToParent(message);
                    });


                    window.player.on("mute", function (e) {
                        const message = {action:"mute", video: getVideo('mute')};
                        if (track) console.log(message);
                        postMessageToParent(message);
                    });

                    window.player.on("pause", function (e) {
                        const message = {action:"pause", video: getVideo('pause')};
                        if (track) console.log(message);
                        postMessageToParent(message);
                    });

                    window.player.on("stop", function (e) {
                        const message = {action:"stop", video: getVideo('stop')};
                        if (track) console.log(message);
                        postMessageToParent(message);
                    });

                    window.player.on("finish", function (e) {
                        const message = {action:"finish", video: getVideo('finish')};
                        if (track) console.log(message);
                        postMessageToParent(message);
                    });

                    window.player.on("seek",function(e)
                    {
                        const message = {action:"seek", video: getVideo('seek')};
                        if (track) console.log(message);
                        postMessageToParent(message);
                    });

                    window.player.on('error', function(e) {
                        console.error(e)
                    })
                }

                if (autoStart) play();

                

            </script>
        </body>

    <html>
`

export const renderVideoPlayer = (settings) => {

    return HTML
        .replace(/\[PH[.]PLATFORMURL\]/g, settings.platformUrl)
        .replace(/\[PH[.]M3U8\]/g, settings.m3u8Location)
        .replace(/\[PH[.]DOMAIN\]/g, settings.domain)
        .replace(/\[PH[.]PROTOCOL\]/g, settings.protocol)
        .replace(/\[PH[.]MP4\]/g, settings.mp4Location ? settings.mp4Location : '')
        .replace(/\[PH[.]COVER\]/g, settings.coverPhotoLocation ? settings.coverPhotoLocation : '')
        .replace(/\[PH[.]JUMP\]/g, _.isNumber(settings.jump) ? settings.jump : -1)
        .replace(/\[PH[.]START\]/g, settings.start ? settings.start : '')
        .replace(/\[PH[.]TRACK\]/g, settings.track)

}


