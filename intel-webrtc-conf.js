(function(angular){
    'use strict';

    var scripts = document.getElementsByTagName("script");
    var currentScriptPath = scripts[scripts.length-1].src;

    angular
      .module('ngIntelWebrtcConf', [ 'ui.router' ])
      .component('intelWebrtc', {
          templateUrl: currentScriptPath.replace('intel-webrtc-conf.js', 'template.html'),
          controller: ctlrIntelWebrtc,
          bindings: {
              start: '='
          }
      });

      ctlrIntelWebrtc.$inject = ['$scope', '$rootScope', '$compile'];

      function ctlrIntelWebrtc($scope, $rootScope, $compile) {
        var self = this;
        $scope.config = {
            room_id : '',
            token : '',
            extension_id: '',
            share_screen : false,
            isHttps: false,
            stun_server_ip: null,
            turn_server_ip: null,
            isNodeWebkit: false
        };
        var woogeenClient = Woogeen.ConferenceClient.create({});
        var streams = {
            local: null,
            remote: null,
            localScreen: null
        };
        $scope.status = "initializing";
        $scope.substatus = "searching_camera";
        $scope.onShare = false;
        $scope.selected_camera = "indefinida";
        $scope.cameraIds = [];

        $scope.safeApply = function(fn) {
            var phase = this.$root.$$phase;
            if(phase == '$apply' || phase == '$digest') {
                if(fn && (typeof(fn) === 'function')) {
                    fn();
                }
            } else {
                this.$apply(fn);
            }
        }

        $scope.searchCameras = function() {
            $scope.safeApply(function() {
                $scope.substatus = "searching_camera";
            });
            navigator.mediaDevices.enumerateDevices()
                .then(function gotDevices(deviceInfos) {
                    deviceInfos.map(function(device) {
                        if (device.kind === 'videoinput') {
                            $scope.cameraIds.push(device);
                        }
                    });
                    if ($scope.cameraIds.length == 0) {
                        launchMessage({
                          text: "No se ha encontrado una cámara."
                        });
                        $scope.safeApply(function() {
                            $scope.substatus = "cant_search_cameras";
                        });
                        return;
                    }
                    $scope.safeApply(function() {
                        $scope.substatus = "";
                    });
                })
                .catch(function fail(error) {
                    launchMessage({
                      text: "No se ha encontrado una cámara."
                    });
                    $scope.safeApply(function() {
                        $scope.substatus = "cant_search_cameras";
                    });
                    console.error('navigator.getUserMedia error: ', error);
                });
        }

        $scope.searchCameras();

        self.start = function(configParams) {
            $scope.status = "configuration";

            if (typeof configParams === 'undefined' || typeof configParams.room_id === 'undefined' || configParams.room_id == '') {
                launchMessage({
                  text: 'La sala es inválida. No se puede iniciar la llamada.'
                });
                return;
            }
            if (typeof configParams.token === 'undefined' || configParams.token == '') {
                launchMessage({
                  text: 'El token es inválido. No se puede iniciar la llamada.'
                });
                return;
            }
            $scope.config.room_id = configParams.room_id;
            $scope.config.token = configParams.token;
            $scope.config.extension_id = (typeof configParams.extension_id !== 'undefined' ? configParams.extension_id : $scope.config.extension_id);
            $scope.config.isNodeWebkit = (typeof configParams.isNodeWebkit !== 'undefined' ? configParams.isNodeWebkit : $scope.config.isNodeWebkit);
            $scope.config.share_screen = (typeof configParams.share_screen !== 'undefined' ? configParams.share_screen : $scope.config.share_screen);
            $scope.config.stun_server_ip = (typeof configParams.stun_server_ip !== 'undefined' ? configParams.stun_server_ip : $scope.config.stun_server_ip);
            $scope.config.turn_server_ip = (typeof configParams.turn_server_ip !== 'undefined' ? configParams.turn_server_ip : $scope.config.turn_server_ip);

            if ($scope.config.isNodeWebkit) {
                nw.Screen.Init();
            }
        }

        function displayStream (stream, resolution, type) {
            var classCont = "";
            var videoCont = "";
            if (type == 'localStream') {
                classCont = "intel-webrtc-box-video back-100";
                videoCont = "localVideo";
            } else if (type == 'remoteStream') {
                classCont = "intel-webrtc-box-video front-small box-video-" + stream.id();
                videoCont = "remoteVideo" + stream.id();
            } else {
                classCont = "intel-webrtc-box-video front-small box-video-" + stream.id();
                videoCont = "localScreen";
                type = "localScreen";
            }

            var nuevoBox = "";
            nuevoBox += "<div class='" + classCont + " " + type + "'  ng-click='swapVideos(\"" + type + "\")'>";
            nuevoBox += " <div id='" + videoCont + "' class='intel-webrtc-video'>";
            nuevoBox += " </div>";
            nuevoBox += "</div>";

            angular.element(document.getElementById('intel-webrtc-box-videos')).append($compile(nuevoBox)($scope))

            stream.show(videoCont);
        }

        $scope.swapVideos = function(videoClass) {
            var videoBack = document.getElementsByClassName("intel-webrtc-box-video back-100")[0];
            var videoFront = document.getElementsByClassName("front-small " + videoClass)[0];

            if (typeof videoFront == 'undefined') {
                videoFront = document.getElementsByClassName("front-small")[0];
            }
            if (typeof videoFront == 'undefined') {
                return;
            }

            videoFront.classList.remove("front-small");
            videoFront.classList.add("back-100");
            videoBack.classList.remove("back-100");
            videoBack.classList.add("front-small");
        }

        function requestFullScreen(element) {
            // Supports most browsers and their versions.
            var requestMethod = element.requestFullScreen || element.webkitRequestFullScreen || element.mozRequestFullScreen || element.msRequestFullScreen;

            if (requestMethod) { // Native full screen.
                requestMethod.call(element);
            } else if (typeof window.ActiveXObject !== "undefined") { // Older IE.
                var wscript = new ActiveXObject("WScript.Shell");
                if (wscript !== null) {
                    wscript.SendKeys("{F11}");
                }
            }
        }

        function exitFullScreen(element) {
            // Supports most browsers and their versions.
            var exitMethod = document.exitFullscreen || document.webkitExitFullscreen || document.mozCancelFullScreen || document.msExitFullscreen;

            if (exitMethod) { // Native full screen.
                exitMethod.call(document);
            } else if (typeof window.ActiveXObject !== "undefined") { // Older IE.
                var wscript = new ActiveXObject("WScript.Shell");
                if (wscript !== null) {
                    wscript.SendKeys("{F11}");
                }
            }
        }

        $scope.swapMaximizeVideos = function() {
            var boxVideos = document.getElementById("intel-webrtc-box-videos-full");
            if((window.fullScreen) || (window.innerWidth == screen.width && window.innerHeight == screen.height)) {
                exitFullScreen(boxVideos);
            } else {
                requestFullScreen(boxVideos);
            }
        }

        function trySubscribeStream (stream) {
            if (!(stream instanceof Woogeen.RemoteMixedStream)) {
                if (streams.local != stream) {
                    L.Logger.info('subscribing:', stream.id());
                    woogeenClient.subscribe(stream, function () {
                        L.Logger.info('subscribed:', stream.id());
                        displayStream(stream, {}, 'remoteStream');
                    }, function (err) {
                        L.Logger.error(stream.id(), 'subscribe failed:', err);
                    });
                } else {
                    displayStream(stream, {}, 'localStream');
                }
            }
        }

        function finalizarStreams() {
            $scope.safeApply(function() {
              $scope.status = 'finished';
              $scope.substatus = "";
            });
            $scope.onShare = false;
            if (streams.local){
                streams.local.close();
                if (streams.local.channel && typeof streams.local.channel.close === 'function') {
                    streams.local.channel.close();
                }
            }
            if (streams.localScreen){
                streams.localScreen.close();
                if (streams.localScreen.channel && typeof streams.localScreen.channel.close === 'function') {
                    streams.localScreen.channel.close();
                }
            }
            for (var i in woogeenClient.remoteStreams) {
                if (woogeenClient.remoteStreams.hasOwnProperty(i)) {
                    var stream = woogeenClient.remoteStreams[i];
                    stream.close();
                    if (stream.channel && typeof stream.channel.close === 'function') {
                        stream.channel.close();
                    }
                    delete woogeenClient.remoteStreams[i];
                }
            }
        };

        woogeenClient.on('server-disconnected', function () {
            launchMessage({
                text: "Hubo un error al conectar con el servidor."
            });
            L.Logger.info('Server disconnected');
        });

        woogeenClient.on('stream-added', function (event) {
            var stream = event.stream;
            L.Logger.info('stream added:', stream.id());
            var fromMe = false;
            for (var i in woogeenClient.localStreams) {
              if (woogeenClient.localStreams.hasOwnProperty(i)) {
                if (woogeenClient.localStreams[i].id() === stream.id()) {
                  fromMe = true;
                  break;
                }
              }
            }
            if (fromMe) {
              L.Logger.info('stream', stream.id(), 'is from me; will not be subscribed.');
              return;
            }
            trySubscribeStream(stream);
        });

        woogeenClient.on('stream-removed', function (event) {
            var stream = event.stream;
            var id = 'remoteVideo' + stream.id();
            var element = document.getElementsByClassName('box-video-' + stream.id())[0];
            if (typeof element !== 'undefined' && element != null) {
                element.parentElement.removeChild(element);
            }
        });

        $scope.initCall = function() {
            //setea stun y turn servers
            var stunJson = {};
            if ($scope.config.stun_server_ip !== null) {
                stunJson.urls = 'stun:' + $scope.config.stun_server_ip;
            }
            var turnJson = {};
            if ($scope.config.turn_server_ip !== null) {
                turnJson.urls = ['turn:' + $scope.config.turn_server_ip + '?transport=udp', 'turn:' + $scope.config.turn_server_ip + '?transport=tcp'];
            }
            woogeenClient.setIceServers([
                stunJson,
                turnJson
            ]);

            $scope.safeApply(function() {
              $scope.status = "calling";
              $scope.substatus = "";
            });
            //--setea logs
            L.Logger.setLogLevel(L.Logger.INFO);
            //--chequea si es https
            $scope.config.isHttps = (location.protocol === 'https:');

            //--se une a la sala
            woogeenClient.join($scope.config.token, function (resp) {
                //--crea el stream local
                if ($scope.selected_camera == null || $scope.selected_camera == 'indefinida') {
                    Woogeen.LocalStream.create({
                        video: {
                            device: 'camera'
                        },
                        audio: true
                    }, function (err, stream) {
                        if (err) {
                            $scope.safeApply(function() {
                                $scope.status = "configuration";
                                $scope.substatus = "";
                            });
                            launchMessage({
                              text: "Hubo un error al acceder a la cámara."
                            });
                            return L.Logger.error('create LocalStream failed:', err);
                        }
                        streams.local = stream;
                        trySubscribeStream(stream);
                        woogeenClient.publish(streams.local, {
                            maxVideoBW: 300,
                            unmix: true
                        }, function (st) {
                            L.Logger.info('stream published:', st.id());
                        }, function (err) {
                            launchMessage({
                              text: "Hubo un error al conectar con el servidor."
                            });
                            L.Logger.error('publish failed:', err);
                        });
                    });
                } else {
                    navigator.mediaDevices.getUserMedia({
                        audio: true,
                        video: {
                            deviceId: {
                                exact: $scope.selected_camera
                            }
                        }
                    }).
                        then(function(myStream) {
                            streams.local = new Woogeen.LocalStream({
                                video: {
                                    device: 'camera'
                                },
                                audio: true,
                                mediaStream: myStream
                            });
                            trySubscribeStream(streams.local);
                            woogeenClient.publish(streams.local, {
                                maxVideoBW: 300,
                                unmix: true
                            }, function (st) {
                                L.Logger.info('stream published:', st.id());
                            }, function (err) {
                                launchMessage({
                                  text: "Hubo un error al conectar con el servidor."
                                });
                                L.Logger.error('publish failed:', err);
                            });
                        })
                        .catch(function fail(err) {
                            $scope.safeApply(function() {
                                $scope.status = "finished";
                                $scope.substatus = "";
                            });
                            launchMessage({
                              text: "Hubo un error al acceder a la cámara."
                            });
                        })
                }

                var remoteStreams = resp.streams;
                remoteStreams.map(function (stream) {
                    L.Logger.info('stream in conference:', stream.id());
                    trySubscribeStream(stream);
                });
            }, function (err) {
                $scope.safeApply(function() {
                    $scope.status = "configuration";
                });
                launchMessage({
                  text: "Hubo un error al conectar con el servidor."
                });
                L.Logger.error('server connection failed:', err);
            });
        }

        $scope.initShare = function() {
            if ($scope.config.isNodeWebkit) {
                nw.Screen.chooseDesktopMedia(["window","screen"],
                function(streamId) {
                    var vid_constraint = {
                        mandatory: {
                            chromeMediaSource: 'desktop',
                            chromeMediaSourceId: streamId,
                            maxWidth: 1920,
                            maxHeight: 1080
                        },
                        optional: []
                    };
                    navigator.webkitGetUserMedia({audio: false, video: vid_constraint}, function success(stream_asd) {
                        $scope.safeApply(function() {
                          $scope.onShare = true;
                        });
                        streams.localScreen = new Woogeen.LocalStream({
                            audio:false,
                            video: {
                                device: 'screen'
                            },
                            mediaStream: stream_asd
                        });
                        displayStream(streams.localScreen, {}, 'localScreen');
                        woogeenClient.publish(streams.localScreen, {
                            maxVideoBW: 300,
                            unmix: true
                        }, function (st) {
                            L.Logger.info('stream published:', st.id());
                        }, function (err) {
                            launchMessage({
                              text: "Hubo un error al conectar con el servidor."
                            });
                            L.Logger.error('publish failed:', err);
                        });
                    }, function fail(err) {
                        console.error(err);
                    });
                });
            } else {
                woogeenClient.shareScreen({extensionId: $scope.config.extension_id}, function (stream) {
                    streams.localScreen = stream;
                    $scope.safeApply(function() {
                        $scope.onShare = true;
                    });
                    displayStream(streams.localScreen, {}, 'localScreen');
                }, function (err) {
                    if (streams.localScreen != null) {
                        displayStream(streams.localScreen, {}, 'localScreen');
                        $scope.safeApply(function() {
                            $scope.onShare = true;
                        });
                    } else {
                        L.Logger.error('share screen failed:', err);
                        launchMessage({
                          text: "No se pudo compartir la pantalla. Por favor verifique que el ID de la extensión sea el correcto."
                        });
                    }
                });
            }
        }

        $scope.finishShare = function() {
            streams.localScreen.close();
            if (streams.localScreen.channel && typeof streams.localScreen.channel.close === 'function') {
                streams.localScreen.channel.close();
            }
            streams.localScreen = null;
            $scope.onShare = false;
        }

        $scope.finishCall = function() {
            finalizarStreams();
            $scope.onShare = false;
            $scope.safeApply(function() {
              $scope.status = "finished";
              $scope.substatus = "";
            });
        }


        $rootScope.$on('$stateChangeSuccess', function() {
            finalizarStreams();
        });

        var messageCount = 0;
        function launchMessage(message) {
          var nuevoMsg = "";
          nuevoMsg += "<div class='error-toast error-msg-" + messageCount + "' ng-click='removeThisMsg(" + messageCount + ")'>";
          nuevoMsg += " <p>" + message.text + "</p>";
          nuevoMsg += "</div>";
          messageCount++;

          angular.element(document.getElementById('errorMessages')).append($compile(nuevoMsg)($scope))
        }

        $scope.removeThisMsg = function(counter) {
          document.getElementsByClassName("error-msg-" + counter)[0].remove();
        }
      }

})(angular);
