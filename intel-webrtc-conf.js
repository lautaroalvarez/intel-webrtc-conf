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
              token: '=',
              room: '=',
              shareScreen: '='
          }
      });

      ctlrIntelWebrtc.$inject = ['$scope', '$rootScope'];

      function ctlrIntelWebrtc($scope, $rootScope) {
        var self = this;
        $scope.config = {
            room_id : '',
            token : '',
            extension_id: '',
            shareScreen : false,
            isHttps: false
        };
        var woogeenClient = Woogeen.ConferenceClient.create({});
        var streams = {
            local: null,
            remote: null,
            localScreen: null
        };
        $scope.onCall = false;
        $scope.onShare = false;

        function displayStream (stream, resolution) {
            var div = document.createElement('div');
            var streamId = stream.id();
            if (stream instanceof Woogeen.RemoteMixedStream) {
                resolution = resolution || {width: 640, height: 480};
            }
            if (!resolution.width || !resolution.height || resolution.width > 640) {
                resolution = {width: 640, height: 480};
            }
            div.setAttribute('style', 'width: '+resolution.width+'px; height: '+resolution.height+'px; margin: 0 auto;');
            div.setAttribute('id', 'remoteVideo' + streamId);
            div.setAttribute('title', 'Stream#' + streamId);
            document.getElementById('intel-webrtc-box-videos').appendChild(div);
            stream.show('remoteVideo' + streamId);
        }

        function trySubscribeStream (stream) {
            if (stream instanceof Woogeen.RemoteMixedStream) {
                stream.on('VideoLayoutChanged', function () {
                    L.Logger.info('stream', stream.id(), 'VideoLayoutChanged');
                });
                L.Logger.info('subscribing:', stream.id());
                var resolutions = stream.resolutions();
                var videoOpt = true;
                var resolution;
                if (resolutions.length >= 1) {
                    resolution = resolutions[0];
                }
                videoOpt = {resolution: resolution};
                L.Logger.info('subscribe stream with option:', resolution);
                woogeenClient.subscribe(stream, {video: videoOpt}, function () {
                    L.Logger.info('subscribed:', stream.id());
                    displayStream(stream, resolution);
                }, function (err) {
                    L.Logger.error(stream.id(), 'subscribe failed:', err);
                });
            }
        }

        function finishStreams() {
            $scope.onCall = false;
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
            L.Logger.info('Server disconnected');
        });

        woogeenClient.on('stream-added', function (event) {
            var stream = event.stream;
            // if(stream.id() !== localStream.id()) return;
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

        $scope.initCall = function() {
            $scope.config.room_id = self.room;
            $scope.config.extension_id = self.extensionId;
            $scope.config.token = self.token;
            $scope.config.shareScreen = (self.shareScreen ? true : false);
            $scope.onCall = true;
            //--setea logs
            L.Logger.setLogLevel(L.Logger.INFO);
            //--chequea si es https
            $scope.config.isHttps = (location.protocol === 'https:');

            //--se une a la sala
            woogeenClient.join($scope.config.token, function (resp) {
                //--crea el stream local
                Woogeen.LocalStream.create({
                    video: {
                        device: 'camera'
                    },
                    audio: true
                }, function (err, stream) {
                    if (err) {
                        $scope.$apply(function() {
                            $scope.onCall = false;
                        });
                        return L.Logger.error('create LocalStream failed:', err);
                    }
                    streams.local = stream;
                    trySubscribeStream(stream);
                    woogeenClient.publish(streams.local, {maxVideoBW: 300}, function (st) {
                        L.Logger.info('stream published:', st.id());
                    }, function (err) {
                        L.Logger.error('publish failed:', err);
                    });
                });

                var remoteStreams = resp.streams;
                remoteStreams.map(function (stream) {
                    L.Logger.info('stream in conference:', stream.id());
                    trySubscribeStream(stream);
                });
            }, function (err) {
                $scope.$apply(function() {
                    $scope.onCall = false;
                });
                L.Logger.error('server connection failed:', err);
            });
        }

        $scope.initShare = function() {
            woogeenClient.shareScreen({extensionId: $scope.config.extension_id}, function (stream) {
                streams.localScreen = stream;
                woogeenClient.mix(streams.localScreen, function() {
                  $scope.$apply(function() {
                      $scope.onShare = true;
                  });
                }, function(err) {
                  L.Logger.error('mix failed:', err);
                });
            }, function (err) {
                if (streams.localScreen != null) {
                    woogeenClient.mix(streams.localScreen, function() {
                      $scope.$apply(function() {
                          $scope.onShare = true;
                      });
                    }, function(err) {
                      L.Logger.error('mix failed:', err);
                    });
                } else {
                    L.Logger.error('share screen failed:', err);
                }
            });
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
            finishStreams();
            $scope.onShare = false;
            $scope.onCall = false;
        }


        $rootScope.$on('$stateChangeSuccess', function() {
            finishStreams();
        });
      }

})(angular);
