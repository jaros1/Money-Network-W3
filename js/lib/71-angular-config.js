// angularJS app
angular.module('MoneyNetworkW3', ['ngRoute', 'ngSanitize', 'ui.bootstrap', 'ngDialog']);

angular.module('MoneyNetworkW3')

    .config(['$routeProvider', function ($routeProvider) {

        var pgm = 'routeProvider: ';

        var set_z_path = ['$location', function ($location) {
            var pgm = 'routeProvider.set_z_path: ';
            var a_path, a_search, z_path, key;
            a_path = $location.path();
            a_search = $location.search();
            z_path = "?path=" + a_path;
            for (key in a_search) z_path += '&' + key + '=' + a_search[key];
            // console.log(pgm + 'z_path = ' + z_path) ;
            ZeroFrame.cmd("wrapperReplaceState", [{"scrollY": 100}, "Money Network W3", z_path]);
            return z_path;
        }];

        // setup routes. For now only one page wallet
        $routeProvider
            .when('/wallet', {
                templateUrl: 'wallet.html',
                controller: 'WalletCtrl as w',
                resolve: {check_auth: set_z_path}
            })
            .otherwise({
                redirectTo: function () {
                    // error or startup. redirect to wallet page
                    var pgm = 'routeProvider.otherwise: ';
                    var search, a_path, z_path, i, sessionid, pubkey2, params ;
                    search = window.location.search;
                    // console.log(pgm + 'search = ', search) ;
                    params = [] ;
                    // check for sessionid
                    i = search.indexOf('sessionid=');
                    if (i != -1) {
                        sessionid = search.substr(i + 10);
                        i = sessionid.indexOf('&');
                        if (i != -1) sessionid = sessionid.substr(0, i);
                        params.push('sessionid=' + sessionid) ;
                    }
                    // redirect
                    if (!params.length) a_path = '/wallet' ; // error or maybe a standalone wallet call
                    else a_path = '/wallet?' + params.join('&') ; // sessionid and/or pubkey2
                    // console.log(pgm + 'a_path = ' + a_path) ;
                    ZeroFrame.cmd("wrapperReplaceState", [{"scrollY": 100}, "", a_path]);
                    return a_path;
                }
            });

        // end config (ng-routes)

    }])

;


