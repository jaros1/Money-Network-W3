angular.module('MoneyNetworkW3')

    // etherService and MoneyNetworkW3Service
    // abbreviations:
    // - MN - MoneyNetwork - main site
    // - W3 - MoneyNetworkW3 - plugin wallet site with test ether

    // https://coderwall.com/p/ngisma/safe-apply-in-angular-js
    // fixing problems in chatCtrl.approve_money_transactions
    // no error in first approve call. errors in second approve call
    .factory('safeApply', [function($rootScope) {
        return function($scope, fn) {
            var phase = $scope.$root ? $scope.$root.$$phase : null;
            if(phase == '$apply' || phase == '$digest') {
                if (fn) {
                    $scope.$eval(fn);
                }
            } else {
                if (fn) {
                    $scope.$apply(fn);
                } else {
                    $scope.$apply();
                }
            }
        }
    }])

    .factory('etherService', ['$timeout', '$rootScope', '$window', '$location',
        function ($timeout, $rootScope, $window, $location) {
            var service = 'MoneyNetworkW3Service';
            console.log(service + ' loaded');

            // https://docs.ethers.io/ethers.js

            var Wallet = ethers.Wallet;
            var providers = ethers.providers;
            var network = providers.networks.ropsten; // Ropsten (the test network)
            var provider = providers.getDefaultProvider(network) ;
            var utils = ethers.utils;
            var ether_wallet ;

            var wallet_info = {
                status: 'n/a',
                confirmed_balance: null,
                unconfirmed_balance: null
            } ;
            function get_wallet_info () {
                return wallet_info ;
            }

            function createRandomWallet (status, cb) {
                var pgm = service + '.createRandomWallet: ' ;
                if (ether_wallet) return cb('Ether wallet is already open') ;
                if (status.login_method != '2') return cb('Error. login_method must be 2 to create a random ether wallet') ;
                ether_wallet = Wallet.createRandom() ;
                ether_wallet.provider = provider;
                status.login_method = '1' ;
                status.wallet_private_key = ether_wallet.privateKey ;
                wallet_info.status = 'Open' ;
                cb(null) ;
            } // createRandomWallet


            function is_login_info_missing (status) {
                var pgm = service + '.openWallet: ';
                if (status.login_method == '1') {
                    // open with private key
                    if (!status.wallet_private_key) return 'Please enter Wallet private key' ;
                }
                else if (status.login_method == '3') {
                    // open encrypted JSON wallet
                    if (!status.wallet_encrypted_json) return 'Please enter encrypted JSON' ;
                    if (!status.wallet_password) return 'Please password for encrypted JSON' ;
                }
                else if (status.login_method == '4') {
                    // Mnemonic Wallet
                    if (!status.wallet_mnemonic) return 'Please enter wallet mnemonic' ;
                }
                else if (status.login_method == '5') {
                    // Brain wallet
                    if (!status.wallet_username) return 'Please enter wallet username' ;
                    if (!status.wallet_password) return 'Please enter wallet password' ;
                }
                else return 'Cannot open wallet for login_method ' + JSON.stringify(status.login_method) ;
                return ;
            } // is_login_info_missing


            function openWallet(status, cb) {
                var pgm = service + '.openWallet: ';
                var error ;
                if (ether_wallet) return cb('Ether wallet is already open') ;
                error = is_login_info_missing(status) ;
                if (error) return cb(error) ;
                if (status.login_method == '1') {
                    // open with private key
                    ether_wallet = new Wallet(status.wallet_private_key) ;
                }
                else if (status.login_method == '3') {
                    // open encrypted JSON wallet
                    ether_wallet = Wallet.fromEncryptedWallet(status.wallet_encrypted_json, status.wallet_password) ;
                    ether_wallet.provider = provider;
                }
                else if (status.login_method == '4') {
                    // Mnemonic Wallet
                    ether_wallet = Wallet.fromMnemonic( status.wallet_mnemonic) ;
                    ether_wallet.provider = provider;
                }
                else if (status.login_method == '5') {
                    // Brain wallet
                    ether_wallet = Wallet.fromBrainWallet(status.wallet_username, status.wallet_password) ;
                }
                if (!ether_wallet) return cb('Open wallet failed') ;
                ether_wallet.provider = provider;
                wallet_info.status = 'Open' ;
                get_balance(cb) ;
            } // openWallet

            function get_balance (cb) {
                var pgm = service + '.get_balance: ' ;
                var unconfirmed_balance_wei_s, unconfirmed_balance_wei_bn, confirmed_balance_wei_s, confirmed_balance_wei_bn ;
                // get latest unconfirmed balance (latest block)
                ether_wallet.getBalance().then(function(unconfirmed_balance) {
                    wallet_info.unconfirmed_balance = unconfirmed_balance.toString(10) ;
                    unconfirmed_balance_wei_s = unconfirmed_balance.toString(10) ;
                    unconfirmed_balance_wei_bn = new BigNumber(unconfirmed_balance_wei_s) ;
                    provider.getBlockNumber().then(function(blockNumber) {
                        console.log(pgm + "Current block number: " + blockNumber);
                        // get confirmed balance. 12 blocks
                        ether_wallet.getBalance(blockNumber-12).then(function(confirmed_balance) {
                            wallet_info.confirmed_balance = confirmed_balance.toString(10) ;
                            confirmed_balance_wei_s = confirmed_balance.toString(10) ;
                            confirmed_balance_wei_bn = new BigNumber(confirmed_balance_wei_s) ;
                            // unconfirmed_balance_wei_bn = unconfirmed_balance_wei_bn.minus(confirmed_balance_wei_bn) ;
                            unconfirmed_balance_wei_s = unconfirmed_balance_wei_bn.toString(10) ;
                            console.log(pgm + 'confirmed balance wei = ' + confirmed_balance_wei_s);
                            console.log(pgm + 'unconfirmed balance wei = ' + unconfirmed_balance_wei_s);
                            wallet_info.unconfirmed_balance = unconfirmed_balance_wei_s ;
                            wallet_info.confirmed_balance = confirmed_balance_wei_s ;

                            $rootScope.$apply() ;
                            cb(null) ;
                        }) ; // getBalance callback 3 (confirmed)
                    }); // getBlockNumber callback 2
                }); // getBalance callback 1 (unconfirmed)
            } // get_balance

            function close_wallet (cb) {
                if (!ether_wallet) return cb('Wallet not open. Please log in first') ;
                ether_wallet = null ;
                wallet_info.status = 'n/a' ;
                wallet_info.confirmed_balance = null ;
                wallet_info.unconfirmed_balance = null ;
                cb(null) ;
            } // close_wallet

            function delete_wallet (cb) {
                if (!ether_wallet) return cb('Wallet not open. Please log in first') ;
                // confirm operation!
                ZeroFrame.cmd("wrapperConfirm", ["Delele wallet?", "OK"], function (confirm) {
                    if (!confirm) return cb('Wallet was not deleted')  ;
                    // delete wallet.
                    ether_wallet.deleteWallet(function (error, success) {
                        if (success) {
                            ether_wallet = null ;
                            wallet_info.status = 'n/a' ;
                            wallet_info.confirmed_balance = null ;
                            wallet_info.unconfirmed_balance = null ;
                            cb(null);
                        }
                        else cb('Could not delete wallet. error = ' + JSON.stringify(error)) ;
                    }) ;
                }) ;

            } // delete_wallet

            // get_address (receive money) - only one address = wallet address in this ether wallet implementation
            function get_address (cb) {
                var pgm = service + '.get_address: ' ;
                if (!ether_wallet) return cb('No ether wallet found') ;
                cb(null, ether_wallet.address) ;
            } // get_address

            var wei_factor = new BigNumber('1000000000000000000') ;
            function get_wei_factor () {
                return wei_factor ;
            }

            var thousands_separator = ',' ;
            var decimal_seperator = '.' ;
            (function () {
                var a = 1000 ;
                thousands_separator = a.toLocaleString().charAt(1) ;
                decimal_seperator = thousands_separator == '.' ? ',' : '.' ;
                console.log('thousands_separator = ' + thousands_separator + ', decimal_seperator = ' + decimal_seperator) ;
            })() ;

            // BigNumber.toFixed.
            // - remove trailing zeroes. really many trailing zeroes in ETH amount!
            // - add thousands separators. really big wei integer values
            function bn_toFixed (bn, decimals, add_thousands_separator) {
                var s, parts ;
                if (!decimals) decimals = 0 ; // default 0
                if ([true, false].indexOf(add_thousands_separator) == -1) add_thousands_separator = true ; // default true
                s = bn.toFixed(decimals) ;
                if (decimals) {
                    // remove trailing zeroes. really many trailing zeroes in ETH amount!
                    while (s.length && (s.charAt(s.length-1) == '0')) s = s.substr(0, s.length - 1) ;
                    if (s.charAt(s.length-1) == decimal_seperator) s += '0' ;
                }
                // add thousands separators
                if (!add_thousands_separator) return s ;
                parts = s.toString().split(decimal_seperator);
                parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, thousands_separator);
                s = parts.join(decimal_seperator);
                return s ;
            } // bn_toFixed

            // calculate gas fee.
            // - address to send to
            // - amount in wei. integer or string with integer
            function estimate_fee (address, amount, cb) {
                var pgm = service + '.estimate_fee: ' ;
                var wei_bn, wei_s, transaction, fee, error ;
                if (!ether_wallet) return cb() ;
                if (!address) address = ether_wallet.address ;
                if ((typeof amount == 'number') && (amount == Math.round(amount))) ; // OK wei number
                else if ((typeof amount == 'string') && amount.match(/^[0-9]+$/)) ; // OK wei string
                else {
                    error = 'Invalid estimate_fee call. amount must be an integer (wei). amount = ' + amount ;
                    console.log(pgm + error) ;
                    throw error ;
                }
                wei_bn = new BigNumber(amount) ;
                wei_s = '0x' + wei_bn.toString(16) ;
                transaction = {
                    gasLimit: 21000,
                    to: address,
                    value: wei_s
                } ;
                ether_wallet.estimateGas(transaction).then(function(gasEstimate) {
                    console.log(pgm + 'gasEstimate = ' + gasEstimate.toString(10));
                    provider.getGasPrice().then(function (gasPrice) {
                        console.log(pgm + 'gasPrice = ' + gasPrice.toString(10));
                        fee = gasEstimate.mul(gasPrice) ;
                        console.log(pgm + 'fee ' + fee.toString(10) + ' = gasEstimate ' + gasEstimate.toString(10) + ' * gasPrice ' + gasPrice.toString(10)) ;
                        cb(fee.toString(10), gasEstimate.toString(10), gasPrice.toString(10)) ;
                    }); // getGasPrice callback 2

                }) ; // estimateGas callback 1

            } // estimate_fee


            // confirm: true from w3 UI. false in wallet-wallet communication.
            // amount in ether!
            function send_money (address, amount, confirm, cb) {
                var pgm = service + '.send_money: ' ;
                var wei_bn, wei_s, ether_bn, ether_s, optional_confirm_send_money ;
                if (!ether_wallet) return cb('No ether wallet found') ;
                wei_bn = new BigNumber(amount) ;
                wei_s = bn_toFixed(wei_bn, 0, true) ;
                ether_bn = wei_bn.dividedBy(wei_factor) ;
                ether_s = bn_toFixed(ether_bn, 18) ;

                optional_confirm_send_money = function (cb) {
                    var pgm = service + '.send_money.optional_confirm_send_money: ' ;
                    if (!confirm) return cb() ;
                    // Send 100000 test wei = 0.0000000000001 tETH to 0xee97e4e7c39da4c64426016cc0ce21446595f289c99948dfc04284e7445afeb0?
                    ZeroFrame.cmd("wrapperConfirm", ["Send " + wei_s + ' test wei = ' + ether_s + ' = tETH<br>to ' + address +"?", "OK"], function (confirm) {
                        if (!confirm) return ; // not confirmed. money was not sent
                        // send money
                        cb() ;
                    }) ;
                } ;
                optional_confirm_send_money(function() {
                    var pgm = service + '.send_money optional_confirm_send_money callback 1: ' ;
                    var wei_s, transaction ;
                    wei_s = '0x' + wei_bn.toString(16) ;

                    // new method 4: estimate_fee + send transaction
                    estimate_fee(address, amount, function (fee, gas_estimate, gas_price) {
                        var pgm = service + '.send_money estimate_fee callback 2: ' ;
                        if (!fee) return cb('error. Could not estimate fee', null) ;

                        var transaction = {
                            gasLimit: parseInt(gas_estimate),
                            gasPrice: utils.bigNumberify(gas_price),
                            to: address,
                            data: "0x",
                            value: ethers.utils.parseEther(ether_s)
                        };

                        ether_wallet.sendTransaction(transaction).then(function(transactionHash) {
                            var pgm = service + '.send_money sendTransaction callback 3: ' ;
                            console.log(pgm + 'address = ' + JSON.stringify(address) + ', amount = ' + JSON.stringify(amount) +
                                ', wei_s = ' + JSON.stringify(wei_s) + ', fee = ' + JSON.stringify(fee) +
                                ', gas_estimate = ' + gas_estimate + ', gas_price = ' + gas_price) ;
                            console.log(pgm + 'transaction = ' + JSON.stringify(transaction)) ;
                            console.log(pgm + 'transactionHash = ' + JSON.stringify(transactionHash));

                            cb(null, transactionHash, fee)
                        }) ; // sendTransaction callback 3

                    }) ; // estimate_fee callback 2

                }) ; // optional_confirm_send_money callback 1

            } // send_money

            function get_transaction (transactionid, cb) {
                var pgm = service + '.get_transaction: ' ;
                try {
                    provider.getTransaction(transactionid).then(function (transaction) {
                        var pgm = service + '.get_transaction getTransaction callback: ' ;
                        console.log(pgm + 'transaction = ' + JSON.stringify(transaction)) ;
                        cb(null, transaction)
                    }) ;
                }
                catch (e) {
                    console.log(pgm + 'getTransaction failed', e) ;
                    cb(e.message, null) ;
                }
            } // get_transaction

            // export
            return {
                get_wallet_info: get_wallet_info,
                createRandom: createRandomWallet,
                is_login_info_missing: is_login_info_missing,
                openWallet: openWallet,
                get_balance: get_balance,
                close_wallet: close_wallet,
                delete_wallet: delete_wallet,
                get_address: get_address,
                send_money: send_money,
                estimate_fee: estimate_fee,
                get_transaction: get_transaction,
                get_wei_factor:get_wei_factor,
                bn_toFixed: bn_toFixed
            };

            // end etherService
        }])


    .factory('MoneyNetworkW3Service', ['$timeout', '$rootScope', '$window', '$location', 'etherService', 'brFilter',
        function ($timeout, $rootScope, $window, $location, etherService, br) {
            var service = 'MoneyNetworkW3Service';
            console.log(service + ' loaded');

            var service_started_at = new Date().getTime() ;

            // insert <br> into long notifications. For example JSON.stringify
            function z_wrapper_notification (array) {
                array[1] = br(array[1]) ;
                ZeroFrame.cmd("wrapperNotification", array) ;
            } // z_wrapper_notification


            // for MN <=> W3 integration
            var wallet_info = etherService.get_wallet_info() ;

            // localStorage wrapper. avoid some ZeroNet callbacks. cache localStorage in ls hash
            // ls.save_login[auth_address] = { choice: '0', '1', '2' or '3', login: <choice 1: encrypted or unencrypted login> }
            var ls = { is_loading: true } ;

            function ls_load() {
                ZeroFrame.cmd("wrapperGetLocalStorage", [], function (res) {
                    var pgm = service + '.wrapperGetLocalStorage callback: ';
                    var key, cb ;
                    // console.log(pgm + 'typeof res =' + typeof res) ;
                    // console.log(pgm + 'res = ' + JSON.stringify(res)) ;
                    if (!res) res = [{}] ;
                    res = res[0];
                    // moving values received from ZeroFrame API to JS copy of local storage
                    ls_loaded(res) ;
                }) ;
            } // ls_load
            ls_load() ;

            // localStorage loaded
            function ls_loaded(res) {
                // is siteInfo ready?
                var pgm = service + '.ls_loaded: ' ;
                var wait_for_site_info, key, cb ;
                wait_for_site_info = function() { ls_loaded(res) };
                if (!ZeroFrame.site_info) {
                    $timeout(wait_for_site_info, 500) ;
                    return ;
                }
                // siteInfo is ready
                for (key in res) ls[key] = res[key] ;
                // console.log(pgm + 'ls = ' + JSON.stringify(ls)) ;

                // migrate to newest ls structure
                if (ls.transactions) {
                    // rename transactions to w_sessions
                    ls.w_sessions = ls.transactions ;
                    delete ls.transactions ;
                }
                if (ls.sessions) {
                    // rename sessions to mn_sessions
                    ls.mn_sessions = ls.sessions ;
                    delete ls.sessions ;
                }

                delete ls.is_loading ;

                if (ls.wallet_backup_restored) {
                    z_wrapper_notification(['done', 'OK. W3 was restored from backup<br>filename: ' + ls.wallet_backup_restored.filename]) ;
                    delete ls.wallet_backup_restored ;
                }

                // run callbacks waiting for ls and site_info to be ready. see ls_bind
                while (ls_cbs.length) {
                    cb = ls_cbs.shift() ;
                    cb() ;
                }
            } // ls_loaded

            var ls_cbs = [] ; // any callbacks waiting for ls finish loading?
            function ls_bind(cb) {
                if (ls.is_loading) ls_cbs.push(cb) ;
                else cb() ;
            }

            function ls_get () { return ls }
            function ls_save() {
                var pgm = service + '.ls_save: ' ;
                // console.log(pgm + 'ls = ' + JSON.stringify(ls)) ;
                if (status.restoring) return ;
                ZeroFrame.cmd("wrapperSetLocalStorage", [ls], function () {}) ;
            } // ls_save



            // setup MoneyNetworkAPI
            // MoneyNetworkAPILib.config({debug: true, ZeroFrame: ZeroFrame, optional: "^[0-9a-f]{10}.[0-9]{13}$"}) ; // global options
            // MoneyNetworkAPILib.config({debug: true, ZeroFrame: ZeroFrame, optional: "^[0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f].[0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9]$"}) ; // global options
            var Z_CONTENT_OPTIONAL = "^.*-.*$" ;
            MoneyNetworkAPILib.config({debug: true, ZeroFrame: ZeroFrame, optional: Z_CONTENT_OPTIONAL}) ; // global options

            // inject extra json schemas into MoneyNetworkAPI (internal wallet to wallet communication)
            var extra_json_schemas = {

                "w3_pubkeys": {
                    "type": 'object',
                    "title": 'Send pubkeys (JSEncrypt and cryptMessage) to other wallet session',
                    "description": 'Sent from send_mt and start_mt post processing',
                    "properties": {
                        "msgtype": {"type": 'string', "pattern": '^w3_pubkeys$'},
                        "pubkey": {"type": 'string'},
                        "pubkey2": {"type": 'string'}
                    },
                    "required": ['msgtype', 'pubkey', 'pubkey2'],
                    "additionalProperties": false
                }, // w3_pubkeys

                "w3_check_mt": {
                    "type": 'object',
                    "title": 'Return ether addresses and check money transactions',
                    "description": 'From receiver to sender. Workflow: pubkeys => w3_check_mt. Use this message to exchange ether addresses and crosscheck money transaction information. Identical=execute transactions. Different=abort transactions',
                    "properties": {
                        "msgtype": { "type": 'string', "pattern": '^w3_check_mt$'},
                        "money_transactions": {
                            "type": 'array',
                            "items": {
                                "type": 'object',
                                "properties": {
                                    "action": { "type": 'string', "pattern": '^(Send|Request)$'},
                                    "code": {"type": 'string', "minLength": 2, "maxLength": 5},
                                    "amount": {"type": ['number', 'string'], "description": 'number or string with a formatted number (number.toFixed)'},
                                    "json": {
                                        "type": 'object',
                                        "properties": {
                                            "address": { "type": 'string'},
                                            "return_address": { "type": 'string'}
                                        },
                                        "required": ['address', 'return_address'],
                                        "additionalProperties": false
                                    }
                                },
                                "required": ['action', 'code', 'amount', 'json'],
                                "additionalProperties": false
                            },
                            "minItems": 1
                        }
                    },
                    "required": ['msgtype', 'money_transactions'],
                    "additionalProperties": false
                }, // w3_check_mt

                "w3_start_mt": {
                    "type": 'object',
                    "title": 'start or abort money transactions',
                    "description": 'From sender to receiver. Workflow: w3_check_mt => w3_start_mt. Start or abort money transaction',
                    "properties": {
                        "msgtype": { "type": 'string', "pattern": '^w3_start_mt$'},
                        "pay_results": {
                            "type": 'array',
                            "items": { "type": ['undefined','null','string']},
                            "description": 'null (receiver is sending), ether ether TxHash or an error message). One row with each row in w3_check_mt.money_transactions array',
                            "minItems": 1
                        },
                        "error": { "type": 'string', "description": 'w3_check_mt errors. Inconsistency between transaction in the two wallets.'}
                    },
                    "required": ['msgtype'],
                    "additionalProperties": false
                }, // w3_start_mt

                "w3_end_mt": {
                    "type": 'object',
                    "title": 'end or abort money transactions',
                    "description": 'From receiver to sender. Workflow: w3_start_mt => w3_end_mt. End (pay_results) or abort money transaction (error)',
                    "properties": {
                        "msgtype": { "type": 'string', "pattern": '^w3_end_mt$'},
                        "pay_results": {
                            "type": 'array',
                            "items": { "type": ['undefined','null','string']},
                            "description": 'null (sender is sending) or send ether result (transaction id or error message). One row with each row in w3_check_mt.money_transactions array',
                            "minItems": 1
                        },
                        "error": { "type": 'string', "description": 'w3_start_mt errors. Inconsistency between w3_start_mt and saved transaction info'}
                    },
                    "required": ['msgtype'],
                    "additionalProperties": false
                }, // w3_end_mt

                "w3_cleanup_mt": {
                    "type": 'object',
                    "title": 'cleanup file and data after completed or aborted money transaction',
                    "description": 'From sender to to receiver. Workflow: w3_end_mt => w3_cleanup_mt. Cleanup data in file system and in Ls',
                    "properties": {
                        "msgtype": { "type": 'string', "pattern": '^w3_cleanup_mt$'},
                        "error": { "type": 'string', "description": 'w3_end_mt errors. Inconsistency between w3_end_mt and saved transaction info'}
                    },
                    "required": ['msgtype'],
                    "additionalProperties": false
                } // w3_cleanup_mt

            } ;
            MoneyNetworkAPILib.add_json_schemas(extra_json_schemas, 'w3') ;

            // message workflow between sender of money transaction(s) and receiver of money transaction(s)
            var message_workflow = {
                sender: {
                    start: 'w3_pubkeys',        // 1: send_mt             => send w3_pubkeys
                    w3_check_mt: 'w3_start_mt', // 3: receive w3_check_mt => send w3_start_mt
                    w3_end_mt: 'w3_cleanup_mt'  // 5: receive w3_end_mt   => send w3_cleanup_mt
                },
                receiver: {
                    start: 'w3_pubkeys',        // 1: start_mt            => send w3_pubkeys
                    w3_pubkeys: 'w3_check_mt',  // 2: receive w3_pubkeys  => send w3_check_mt
                    w3_start_mt: 'w3_end_mt',   // 4: receive w3_start_mt => send w3_end_mt
                    w3_cleanup_mt: 'end'        // 6: receive w3_cleanup_mt
                }
            } ;

            var encrypt1 = new MoneyNetworkAPI({debug: 'encrypt1'}) ; // encrypt1. no sessionid. self encrypt/decrypt data in W3 localStorage ;

            // get_wallet_login helper. check login object. return error message or copy login information to status object
            function read_and_save_login (login) {
                if (!login) return 'Login info not found' ;
                if (typeof login != 'object') return 'Login info is not an object. login = ' + JSON.stringify(login) ;
                if (!login.hasOwnProperty('login_method')) return 'Login_method was not found in login object. login = ' + JSON.stringify(login) ;
                if (['1','3','4','5'].indexOf(login.login_method) == -1) return 'Unknown login_method ' + JSON.stringify(login.login_method) ;
                status.login_method = login.login_method ;
                if (status.login_method == '1') status.wallet_private_key = login.wallet_private_key ;
                if (status.login_method == '3') {
                    status.wallet_encrypted_json = login.wallet_encrypted_json ;
                    status.wallet_password = login.wallet_password ;
                }
                if (status.login_method == '4') status.wallet_mnemonic = login.wallet_mnemonic ;
                if (status.login_method == '5') {
                    status.wallet_username = login.wallet_username ;
                    status.wallet_password = login.wallet_password ;
                }
            }

            // save_wallet_login:
            // - '1': wallet login is saved encrypted (cryptMessage) in W3 localStorage
            // - '2': wallet login is saved encrypted (symmetric) in MN localStorage (session is required)
            function get_wallet_login(save_wallet_login, cb) {
                var pgm = service + '.get_wallet_login: ' ;
                var error, auth_address, user_login_info, login, encrypted_json, request ;
                if (['1','2'].indexOf(save_wallet_login) == -1) return cb(null, null, "Invalid call. save_wallet_login must be equal '1' or '2'") ;
                if (save_wallet_login == '1') {
                    // wallet login is saved encrypted (cryptMessage) in W3 localStorage
                    if (!ls.save_login) return cb('save_login hash was not found in localStorage') ;
                    if (typeof ls.save_login != 'object') {
                        error = 'save_login was not a hash. save_login = ' + JSON.stringify(ls.save_login) ;
                        ls.save_login = {} ;
                        ls_save() ;
                        return cb(error) ;
                    }
                    auth_address = ZeroFrame.site_info.cert_user_id ? ZeroFrame.site_info.auth_address : 'n/a' ;
                    user_login_info = ls.save_login[auth_address] ;
                    if (!user_login_info) return cb('Wallet login for ' + auth_address + ' was not found') ;
                    if (auth_address == 'n/a') {
                        // no ZeroNet certificate. wallet login is saved unencrypted in ls. not recommended
                        login = user_login_info.login ;
                        console.log(pgm + 'unencrypted login = ' + JSON.stringify(login)) ;
                        error = read_and_save_login(login) ;
                        if (error) {
                            user_login_info.login = {} ;
                            ls_save() ;
                            return cb(error) ;
                        }
                        return cb(null) ;
                        setTimeout(load_w_sessions, 0) ;
                    }
                    // ZeroNet certificate present. decrypt login
                    encrypted_json = user_login_info.login ;
                    console.log(pgm + 'encrypted_json = ' + JSON.stringify(encrypted_json));
                    encrypt1.decrypt_json(encrypted_json, {}, function(json) {
                        var pgm = service + '.get_wallet_login decrypt_json callback: ' ;
                        console.log(pgm + 'json = ' + JSON.stringify(json)) ;
                        if (!json) return cb('decrypt error. encrypted_json was ' + JSON.stringify(user_login_info)) ;
                        error = read_and_save_login(json) ;
                        if (error) return cb(error) ;
                        cb(null) ;
                        setTimeout(load_w_sessions, 0) ;
                    }) ; // decrypt_json callback
                }
                else {
                    // save_wallet_login == '2'
                    // wallet login is saved encrypted (symmetric) in MN localStorage (session is required)
                    if (!status.sessionid) return cb(null, null, 'Cannot read wallet information. MN session was not found');
                    // send get_data message to MN and wait for response
                    request = { msgtype: 'get_data', keys: ['login'] } ;
                    console.log(pgm + 'sending get_data request to MN. request = ' + JSON.stringify(request)) ;
                    encrypt2.send_message(request, {response: true}, function (response) {
                        var pgm = service + '.get_wallet_login send_message callback: ' ;
                        var encrypted_data, data, decrypt_row ;
                        if (response.error) return cb(null, null, response.error) ;
                        console.log(pgm + 'response = ' + JSON.stringify(response));
                        // response.data - array with 0-n rows with encrypted data. decrypt 0-n data rows
                        encrypted_data = response.data ;
                        data = [] ;
                        decrypt_row = function(cb2) {
                            var pgm = service + '.get_wallet_login.decrypt_row: ' ;
                            var encrypted_row, encrypted_json ;
                            if (encrypted_data.length == 0) return cb2() ;
                            encrypted_row = encrypted_data.shift() ;
                            console.log(pgm + 'encrypted_row = ' + JSON.stringify(encrypted_row)) ;
                            try {
                                encrypted_json = JSON.parse(encrypted_row.value) ;
                            }
                            catch (e) {
                                console.log(pgm + 'error. invalid data response. value was not a json string. value = ' + encrypted_row.value + ', error = ' + e.message);
                                data.push({key: encrypted_row.key, value: null}) ;
                                return decrypt_row(cb2) ;
                            }
                            encrypt1.decrypt_json(encrypted_json, {}, function (decrypted_json) {
                                var pgm = service + '.get_wallet_login.decrypt_row decrypt_json callback: ' ;
                                var decrypted_row ;
                                decrypted_row = {key: encrypted_row.key, value: decrypted_json} ;
                                console.log(pgm + 'decrypted_row = ' + JSON.stringify(decrypted_row));
                                data.push(decrypted_row) ;
                                decrypt_row(cb2) ;
                            }) ; // decrypt_json callback 1
                        };
                        decrypt_row(function() {
                            var pgm = service + '.get_wallet_login decrypt_row callback: ' ;
                            response.data = data ;
                            if ((response.data.length != 1) || (response.data[0].key != 'login')) {
                                console.log(pgm + 'error. expected one row with login info to be returned in data array. response to get_data message was ' + JSON.stringify(response));
                                return cb(null, null, 'Error. Wallet login info was not returned from MN') ;
                            }
                            // OK. received wallet login from MN
                            console.log(pgm + 'data[0] = ' + JSON.stringify(data[0])) ;
                            error = read_and_save_login(data[0].value) ;
                            cb(error) ;
                            setTimeout(load_w_sessions, 0) ;
                        }) ; // decrypt_row callback

                    }) ; // send_message callback
                }
            } // get_wallet_login


            // save_wallet_login:
            // - '0': no thank you. Clear any wallet data previously saved with '1' or '2'
            // - '1': wallet login is saved encrypted (cryptMessage) in W3 localStorage
            // - '2': wallet login is saved encrypted (symmetric) in MN localStorage (session is required)
            function save_wallet_login(save_wallet_login, cb) {
                var pgm = service + '.save_wallet_login: ';
                var cert_user_id, auth_address, data, request, old_login, save_w3;
                if (['0', '1', '2'].indexOf(save_wallet_login) == -1) return cb({error: "Invalid call. save_wallet_login must be equal '0', '1' or '2'"});

                // save wallet login choice in W3 localStorage (choice = 0, 1 or 2)
                cert_user_id = ZeroFrame.site_info.cert_user_id ;
                auth_address = cert_user_id ? ZeroFrame.site_info.auth_address : 'n/a' ;
                if (!ls.save_login) ls.save_login = {};
                if (cert_user_id && ls.save_login[cert_user_id]) delete ls.save_login[cert_user_id] ; // old index
                if (!ls.save_login[auth_address]) ls.save_login[auth_address] = {};
                if (typeof ls.save_login[auth_address] != 'object') {
                    console.log(pgm + 'error. ls.save_login[auth_address] was not a hash. ls.save_login[auth_address] = ' + JSON.stringify(ls.save_login[auth_address])) ;
                    ls.save_login[auth_address] = {} ;
                }
                old_login = JSON.parse(JSON.stringify(ls.save_login[auth_address]));
                ls.save_login[auth_address].choice = save_wallet_login;
                console.log(pgm + 'ls = ' + JSON.stringify(ls)) ;
                ls_save();

                setTimeout(load_w_sessions, 0) ;

                // get and add W3 pubkey2 to encryption setup (self encrypt using ZeroNet certificate)
                get_my_pubkey2(function (my_pubkey2) {
                    var pgm = service + '.save_wallet_login get_my_pubkey2 callback 1: ';
                    var save_w3;
                    encrypt1.setup_encryption({pubkey2: my_pubkey2});

                    // save in W3 localStorage (choice '0' and '1')
                    save_w3 = function (cb) {
                        var pgm = service + '.save_wallet_login.save_w3: ';
                        var unencrypted_login;
                        // create unencrypted object with login info. note different wallet initialize methods
                        if (save_wallet_login != '0') {
                            unencrypted_login = { login_method: status.login_method } ;
                            if (status.login_method == '1') unencrypted_login.wallet_private_key = status.wallet_private_key ;
                            if (status.login_method == '3') {
                                unencrypted_login.wallet_encrypted_json = status.wallet_encrypted_json ;
                                unencrypted_login.wallet_password = status.wallet_password ;
                            }
                            if (status.login_method == '4') unencrypted_login.wallet_mnemonic = status.wallet_mnemonic ;
                            if (status.login_method == '5') {
                                unencrypted_login.wallet_username = status.wallet_username ;
                                unencrypted_login.wallet_password = status.wallet_password ;
                            }
                            console.log(pgm + 'unencrypted_login = ' + JSON.stringify(unencrypted_login));
                        }
                        if (save_wallet_login != '1') {
                            // delete any old login info from W3 localStorage
                            delete ls.save_login[auth_address].login;
                            ls_save();
                            return cb(unencrypted_login);
                        }
                        // save login info in W3 localStorage
                        if (auth_address == 'n/a') {
                            // no cert_user_id. not encrypted
                            ls.save_login[auth_address].login = unencrypted_login ;
                            ls_save();
                            return cb();
                        }
                        // cert_user_id: encrypt login
                        console.log(pgm + 'encrypt1.other_pubkey2 = ' + encrypt1.other_session_pubkey2);
                        encrypt1.encrypt_json(unencrypted_login, {encryptions: [2]}, function (encrypted_login) {
                            ls.save_login[auth_address].login = encrypted_login;
                            ls_save();
                            return cb();
                        });
                    }; // save_w3

                    save_w3(function (unencrypted_login) {
                        var pgm = service + '.save_wallet_login save_w3 callback 2: ';
                        // update MN localStorage (choice '2')
                        if (save_wallet_login == '2') {
                            if (!status.sessionid) {
                                ls.save_login[auth_address] = old_login;
                                return cb({error: 'Error. Cannot save wallet information in MN. MN session was not found'});
                            }
                            // encrypt wallet data before sending data to MN
                            data = unencrypted_login;
                            console.log(pgm + 'data = ' + JSON.stringify(data));
                            // cryptMessage encrypt data with current ZeroId before sending data to MN.
                            // encrypt data before send save_data message
                            encrypt1.encrypt_json(data, {encryptions: [2]}, function (encrypted_data) {
                                var pgm = service + '.save_wallet_login encrypt_json callback 3: ';
                                var request;
                                console.log(pgm + 'data (encrypted) = ' + JSON.stringify(encrypted_data));
                                // send encrypted wallet data to MN and wait for response
                                request = {
                                    msgtype: 'save_data',
                                    data: [{key: 'login', value: JSON.stringify(encrypted_data)}]
                                };
                                console.log(pgm + 'json = ' + JSON.stringify(request));
                                encrypt2.send_message(request, {response: true}, function (response) {
                                    var pgm = service + '.save_wallet_login send_message callback 4: ';
                                    if (!response) cb({error: 'No response'});
                                    else if (response.error) cb({error: response.error});
                                    else cb({}); // OK. login saved in MN
                                }); // send_message callback 4
                            }); // encrypt_json callback 3

                        }
                        else {
                            // 0 or 1. clear old 2
                            if (!status.sessionid) return cb({}); // error: 'Cannot clear wallet information. MN session was not found'
                            // send data_delete to MN session
                            request = {msgtype: 'delete_data'}; // no keys array. delete all data for session
                            console.log(pgm + 'json = ' + JSON.stringify(request));
                            encrypt2.send_message(request, {response: true}, function (response) {
                                var pgm = service + '.save_wallet_login send_message callback 1: ';
                                if (!response) cb({error: 'No response'});
                                else if (response.error) cb({error: response.error});
                                else cb({});
                            }); // send_message callback 1
                        }

                    }); // save_w3 callback 2

                }); // get_my_pubkey2 callback 1

            } // save_wallet_login

            // MN-W3 session. only relevant if W3 is called from MN with a sessionid or an old still working MN-W3 session can be found in localStorage
            // session status: use at startup and after changing/selecting ZeroId
            var status = {
                old_cert_user_id: -1,
                sessionid: null,
                merger_permission: 'n/a', // checking Merger:MoneyNetwork permission
                session_handshake: 'n/a', // checking old/new session
                save_login: '0', // radio group '0', '1' (W3 LS) or '2' (MN LS)
                save_login_disabled: true, // radio group disabled while checking save_wallet_login status
                permissions: {}, // MoneyNetwork permissions to wallet operations
                offline: [], // array with offline outgoing money transaction
                restoring: false // set to true doing restore operation. stop all processes
            } ;
            function get_status () { return status }

            // get permissions from ls (rules for MoneyNetwork wallet operations)
            function get_permissions (cb) {
                var pgm = service + '.get_permissions: ' ;
                var error, auth_address, user_info, permissions, encrypted_json, key ;
                if (!ls.save_login) return cb('save_login hash was not found in localStorage') ;
                if (typeof ls.save_login != 'object') {
                    error = 'save_login was not a hash. save_login = ' + JSON.stringify(ls.save_login) ;
                    ls.save_login = {} ;
                    ls_save() ;
                    for (key in status.permissions) delete status.permissions[key] ;
                    return cb(error) ;
                }
                auth_address = ZeroFrame.site_info.cert_user_id ? ZeroFrame.site_info.auth_address : 'n/a' ;
                user_info = ls.save_login[auth_address] ;
                if (!user_info) return cb('User info for ' + auth_address + ' was not found') ;
                if (auth_address == 'n/a') {
                    // no ZeroNet certificate. login is saved unencrypted in ls
                    permissions = user_info.permissions ;
                    // console.log(pgm + 'unencrypted permissions = ' + JSON.stringify(permissions)) ;
                    if (!permissions) return cb('Permissions for ' + auth_address + ' was not found') ;
                    if (typeof permissions != 'object') {
                        error = 'save_login[' + auth_address + '].permissions is not a hash. permissions = ' + JSON.stringify(permissions) ;
                        user_info.permissions = {} ;
                        ls_save() ;
                        for (key in status.permissions) delete status.permissions[key] ;
                        return cb(error) ;
                    }
                    // copy permissions to status (used in UI)
                    for (key in status.permissions) delete status.permissions[key] ;
                    for (key in permissions) status.permissions[key] = permissions[key] ;
                    // console.log(pgm + 'status.permissions = ' + JSON.stringify(status.permissions));
                    return cb(null) ;
                }
                // ZeroNet certificate present. decrypt permissions
                encrypted_json = user_info.permissions ;
                // console.log(pgm + 'encrypted_json = ' + JSON.stringify(encrypted_json));
                if (!encrypted_json) return cb('No encrypted permissions was found for ' + auth_address) ;
                encrypt1.decrypt_json(encrypted_json, {}, function(json) {
                    var pgm = service + '.get_permissions decrypt_json callback: ' ;
                    var key ;
                    // console.log(pgm + 'json = ' + JSON.stringify(json)) ;
                    if (!json) {
                        for (key in status.permissions) delete status.permissions[key] ;
                        cb('decrypt error. encrypted_json was ' + JSON.stringify(encrypted_json)) ;
                    }
                    else {
                        // copy permissions to status (used in UI)
                        for (key in status.permissions) delete status.permissions[key] ;
                        for (key in json) status.permissions[key] = json[key] ;
                        // console.log(pgm + 'status.permissions = ' + JSON.stringify(status.permissions));
                        cb(null) ;
                    }
                }) ; // decrypt_json callback
            } // get_permissions

            // save permissions in ls (rules for MoneyNetwork wallet operations)
            function save_permissions (cb) {
                var pgm = service + '.save_permissions: ' ;
                var auth_address, unencrypted_permissions ;
                auth_address = ZeroFrame.site_info.cert_user_id ? ZeroFrame.site_info.auth_address : 'n/a' ;
                if (auth_address == 'n/a') {
                    // no cert_user_id. not encrypted
                    ls.save_login[auth_address].permissions = JSON.parse(JSON.stringify(status.permissions)) ;
                    ls_save();
                    return cb();
                }
                // get and add W3 pubkey2 to encryption setup (self encrypt using ZeroNet certificate)
                get_my_pubkey2(function (my_pubkey2) {
                    var pgm = service + '.save_permissions get_my_pubkey2 callback 1: ';
                    encrypt1.setup_encryption({pubkey2: my_pubkey2});
                    // console.log(pgm + 'encrypt1.other_pubkey2 = ' + encrypt1.other_session_pubkey2);

                    // cert_user_id: encrypt permissions
                    unencrypted_permissions = status.permissions;
                    // console.log(pgm + 'unencrypted_permissions = ' + JSON.stringify(unencrypted_permissions)) ;
                    encrypt1.encrypt_json(unencrypted_permissions, {encryptions: [2]}, function (encrypted_permissions) {
                        var pgm = service + '.save_permissions encrypt_json callback 2: ';
                        ls.save_login[auth_address].permissions = encrypted_permissions;
                        // console.log(pgm + 'encrypted_permissions = ' + JSON.stringify(encrypted_permissions)) ;
                        ls_save();
                        return cb();
                    }); // encrypt_json callback 2

                }) ; // get_my_pubkey2 callback 1

            } // save_permissions

            // todo: changed ZeroId. clear z_cache.
            var z_cache = {} ; // cache some ZeroNet objects: wallet_data_hub, wallet.json

            // ZeroFrame wrappers.
            function z_file_get (pgm, options, cb) {
                MoneyNetworkAPILib.z_file_get(pgm, options, cb);
            } // z_file_get
            function z_file_write (pgm, inner_path, content, options, cb) {
                MoneyNetworkAPILib.z_file_write(pgm, inner_path, content, options, cb);
            } // z_file_get

            // normally never used. defaults hubs should be in all_hubs / wallet_data_hubs array
            function get_default_wallet_hub () {
                var pgm = service + '.get_default_wallet_hub: ' ;
                var default_wallet_hub, default_hubs, hub, hubs, i ;
                default_wallet_hub = {hub: '1W3Et1D5BnqfsXfx2kSx8T61fTPz5V2Ft', title: 'W3 Wallet data hub 1'} ;
                console.log(pgm + 'ZeroFrame.site_info.content = ' + JSON.stringify(ZeroFrame.site_info.content));
                if (!ZeroFrame.site_info.content.settings) return default_wallet_hub ;
                default_hubs = ZeroFrame.site_info.content.settings.default_hubs ;
                if (!default_hubs) return default_wallet_hub ;
                hubs = [] ;
                for (hub in default_hubs) hubs.push({hub: hub, title: default_hubs[hub].title}) ;
                if (!hubs.length) return default_wallet_hub ;
                i = Math.floor(Math.random() * hubs.length);
                return hubs[i] ;
            } // get_default_wallet_hub

            // delete old no longer used user profile
            // 1) doublet user profile - keep user profile on last updated wallet hub - delete user profile on other wallet data hubs
            // 2) move user profile (no peers) - delete profile on old wallet data hub
            function cleanup_wallet_hub (hub, cb) {
                var pgm = service + '.cleanup_wallet_hub: ' ;
                var inner_path0, debug_seq0 ;
                if (!cb) cb = function() {} ;
                // sign to update list of files
                inner_path0 = 'merged-' + get_merged_type() + '/' + hub + '/data/users/' + ZeroFrame.site_info.auth_address + '/content.json' ;
                debug_seq0 = MoneyNetworkAPILib.debug_z_api_operation_start(pgm, inner_path0, 'siteSign') ;
                ZeroFrame.cmd("siteSign", {inner_path: inner_path0, remove_missing_optional: true}, function (res1) {
                    var pgm = service + '.cleanup_wallet_hub siteSign callback 1: ';
                    MoneyNetworkAPILib.debug_z_api_operation_end(debug_seq0, res1);
                    if (res1 != 'ok') console.log(pgm + inner_path0 + ' siteSign failed. error = ' + JSON.stringify(res1));
                    // read content.json and get list of files to be deleted
                    z_file_get(pgm, {inner_path: inner_path0}, function(content_str) {
                        var pgm = service + '.cleanup_wallet_hub z_file_get callback 2: ';
                        var content, files, key, delete_file ;
                        content = JSON.parse(content_str) ;
                        files = [] ;
                        for (key in content.files) files.push(key) ;
                        if (content.files_optional) for (key in content.files_optional) files.push(key) ;
                        // delete files loop:
                        delete_file = function() {
                            var pgm = service + '.cleanup_wallet_hub.delete_file 3: ' ;
                            var filename, debug_seq2, inner_path ;
                            filename = files.shift() ;
                            if (!filename) {
                                // directory should be empty now. sign and publish. OK if publish fails. Could be a wallet data hub without peers.
                                inner_path = 'merged-' + get_merged_type() + '/' + hub + '/data/users/' + ZeroFrame.site_info.auth_address + '/content.json' ;
                                MoneyNetworkAPILib.z_site_publish({inner_path: inner_path, remove_missing_optional: true, encrypt: encrypt2, reason: 'cleanup old wallet'}, function (res4) {
                                    var pgm = service + '.cleanup_wallet_hub z_site_publish callback 4a: ';
                                    if (res4 != 'ok') console.log(pgm + inner_path + ' publish failed. error = ' + JSON.stringify(res4));
                                    // done
                                    cb(res4) ;
                                }) ;
                                return ;
                            }
                            inner_path = 'merged-' + get_merged_type() + '/' + hub + '/data/users/' + ZeroFrame.site_info.auth_address + '/' + filename ;
                            MoneyNetworkAPILib.z_file_delete(pgm, inner_path, function (res2) {
                                var pgm = service + '.cleanup_wallet_hub z_file_delete callback 4b: ';
                                if (res2 != 'ok') console.log(pgm + 'error. fileDelete ' + inner_path + ' failed. error = ' + JSON.stringify(res2)) ;
                                // delete next file
                                delete_file() ;
                            }); // z_file_delete callback
                        } ; // delete_file 3
                        // start delete file loop
                        delete_file() ;

                    }) ; // z_file_get callback

                }) ; // siteSign callback

            } // delete_wallet_hub

            // copy user files from current wallet data hub to new wallet data hub
            // for example after failed publish without any peers or move user profile action in user interface
            function move_user_profile(new_wallet_hub, cb) {
                var pgm = service + '.move_user_profile: ' ;

                // steps:
                // 1 - sign current user profile
                // 2 - read current content.json
                // 3 - copy normal files to new wallet data hub
                // 4 - sign new user profile and add optional pattern
                // 5 - copy optional files
                // 6 - delete old user profile
                // 7 - sign and publish new user profile
                // done

                MoneyNetworkAPILib.start_transaction(pgm, function(transaction_timestamp) {

                    var cb2 = function (res) {
                        MoneyNetworkAPILib.end_transaction(transaction_timestamp) ;
                        cb(res) ;
                    } ;

                    // get list of hub titles. For other_wallet_data_hub_title
                    ZeroFrame.cmd("mergerSiteList", [true], function (merger_sites) {
                        var pgm = service + '.move_user_profile mergerSiteList callback 1: ' ;

                        // get current hub (to be moved)
                        get_my_wallet_hub (function (my_wallet_hub, other_wallet_hub, other_wallet_hub_title) {
                            var pgm = service + '.move_user_profile get_my_user_hub callback 2: ' ;
                            var old_user_path, new_user_path, inner_path1, debug_seq1 ;

                            if (!merger_sites[my_wallet_hub]) return cb2('error. current wallet data hub ' + my_wallet_hub + ' is not a merger site') ;
                            if (!merger_sites[new_wallet_hub]) return cb2('error. new wallet hub ' + new_wallet_hub + ' is not a merger site') ;
                            if (my_wallet_hub == new_user_path) return cb2('error. current wallet hub = new wallet hub = ' + new_wallet_hub) ;

                            // 1: sign old user hub and update list of files
                            old_user_path = "merged-" + get_merged_type() + "/" + my_wallet_hub + "/data/users/" + ZeroFrame.site_info.auth_address + '/';
                            new_user_path = "merged-" + get_merged_type() + "/" + new_wallet_hub + "/data/users/" + ZeroFrame.site_info.auth_address + '/';
                            inner_path1 = old_user_path + 'content.json' ;
                            debug_seq1 = MoneyNetworkAPILib.debug_z_api_operation_start(pgm, old_user_path + '/content.json', 'siteSign') ;
                            ZeroFrame.cmd("siteSign", {inner_path: inner_path1, remove_missing_optional: true}, function (res) {
                                var pgm = service + '.move_user_profile siteSign callback 3: ' ;
                                MoneyNetworkAPILib.debug_z_api_operation_end(debug_seq1, res);
                                if (res != 'ok') {
                                    // sign failed
                                    console.log(pgm + 'error. cannot move user profile. siteSign for ' + inner_path1 + ' failed. error = ' + JSON.stringify(res)) ;
                                    return cb2(res) ;
                                }

                                // 2 - sign ok. read old content.json and list of normal files
                                z_file_get(pgm, {inner_path: inner_path1}, function (content_str, extra) {
                                    var pgm = service + '.move_user_profile z_file_get callback 4: ' ;
                                    var content, copy_normal_file ;
                                    if (!content_str) {
                                        console.log(pgm + 'error. cannot move user profile. ' + inner_path1 + ' was not found') ;
                                        return cb2('error. cannot move user profile. ' + inner_path1 + ' was not found') ;
                                    }
                                    content = JSON.parse(content_str) ;
                                    if (!content.files) content.files = {} ;

                                    // 3. copy normal files
                                    copy_normal_file = function() {
                                        var pgm = service + '.move_user_profile copy_normal_file callback 5: ' ;

                                        var filenames, filename, old_inner_path, new_inner_path, inner_path3, format, debug_seq3 ;
                                        filenames = Object.keys(content.files) ;
                                        if (!filenames.length) {
                                            // 4: no more normal files to copy. sign new user profile without optional pattern
                                            inner_path3 = new_user_path + 'content.json' ;
                                            debug_seq3 = MoneyNetworkAPILib.debug_z_api_operation_start(pgm, inner_path3, 'siteSign') ;
                                            ZeroFrame.cmd("siteSign", {inner_path: inner_path3, remove_missing_optional: true}, function (res) {
                                                var pgm = service + '.move_user_profile siteSign callback 6a: ';
                                                MoneyNetworkAPILib.debug_z_api_operation_end(debug_seq3, res);
                                                if (res != 'ok') {
                                                    // sign failed
                                                    console.log(pgm + 'error. cannot move user profile. siteSign for ' + inner_path3 + ' failed. error = ' + JSON.stringify(res));
                                                    return cb2('cannot move user profile. siteSign for ' + inner_path3 + ' failed. error = ' + JSON.stringify(res));
                                                }
                                                // sign new user profile OK. read new content.json. optional pattern must be added before copying optional files
                                                z_file_get(pgm, {inner_path: inner_path3}, function (content_str, extra) {
                                                    var pgm = service + '.move_user_profile z_file_get callback 7a: ';
                                                    var content, json_raw ;
                                                    // add optional pattern before merge_user operation
                                                    content = JSON.parse(content_str) ;
                                                    content.optional = Z_CONTENT_OPTIONAL ;
                                                    json_raw = unescape(encodeURIComponent(JSON.stringify(content, null, "\t")));
                                                    z_file_write(pgm, inner_path3, btoa(json_raw), {}, function (res) {
                                                        var pgm = service + '.move_user_profile z_file_write callback 8a: ';
                                                        if (res != 'ok') {
                                                            console.log(pgm + 'error. cannot move user profile. fileWrite failed for new content.json ' + inner_path3 + '. res = ' + JSON.stringify(res)) ;
                                                            return cb2('error. cannot move user profile. fileWrite failed for new content.json ' + inner_path3 + '. res = ' + JSON.stringify(res)) ;
                                                        }
                                                        // ok fileWrite. sign new user profile with optional pattern
                                                        debug_seq3 = MoneyNetworkAPILib.debug_z_api_operation_start(pgm, inner_path3, 'siteSign') ;
                                                        ZeroFrame.cmd("siteSign", {inner_path: inner_path3, remove_missing_optional: true}, function (res) {
                                                            var pgm = service + '.move_user_profile siteSign callback 9a: ';
                                                            var copy_optional_file ;
                                                            MoneyNetworkAPILib.debug_z_api_operation_end(debug_seq3, res);
                                                            if (res != 'ok') {
                                                                console.log(pgm + 'error. cannot move user profile. siteSign failed for new content.json ' + inner_path3 + '. res = ' + JSON.stringify(res)) ;
                                                                return cb2('error. cannot move user profile. siteSign failed for new content.json ' + inner_path3 + '. res = ' + JSON.stringify(res)) ;
                                                            }
                                                            // siteSign with optional file pattern OK. copy optional files from old user profile to new user profile

                                                            copy_optional_file = function() {
                                                                var pgm = service + '.move_user_profile copy_optional_file callback 10a: ';
                                                                var filenames, filename, old_inner_path, new_inner_path ;
                                                                if (!content.files_optional) content.files_optional = {} ;
                                                                filenames = Object.keys(content.files_optional) ;
                                                                if (!filenames.length) {

                                                                    // end move user profile transaction. using transaction in cleanup_wallet_hub
                                                                    try {
                                                                        MoneyNetworkAPILib.end_transaction(transaction_timestamp) ;
                                                                    }
                                                                    catch (e) {
                                                                        console.log(pgm + 'warning. end_transaction failed. error = ' + e.message) ;
                                                                        // warning. end_transaction failed. error = undefined
                                                                    }

                                                                    // done copying optional file. delete old wallet data hub.
                                                                    cleanup_wallet_hub(z_cache.my_wallet_data_hub, function (res) {
                                                                        var pgm = service + '.move_user_profile cleanup_wallet_hub callback 11a: ';
                                                                        console.log(pgm + 'cleanup_wallet_hub. res = ' + JSON.stringify(res)) ;
                                                                        // res = {"error":"Content publish failed."}

                                                                        // done. copied normal and optional files to new wallet hub. deleted files from old wallet hub. signed and published old empty wallet data hub. Now ready for new wallet data hub. sign and publish now
                                                                        z_cache.other_wallet_data_hub = my_wallet_hub ;
                                                                        z_cache.other_wallet_data_hub_title = merger_sites[my_wallet_hub].content.title ;
                                                                        z_cache.my_wallet_data_hub = new_wallet_hub ;

                                                                        // sign and publish profile on new wallet data hub now
                                                                        z_publish({publish: true}, function (res) {
                                                                            var pgm = service + '.move_user_profile z_site_publish 12a: ';
                                                                            console.log(pgm + 'z_publish. res = ' + JSON.stringify(res)) ;
                                                                            // done
                                                                            cb(res) ;

                                                                        }) ; // z_publish callback 12a

                                                                    }) ; // cleanup_wallet_hub callback 11a
                                                                    return ;
                                                                }
                                                                // path b: copy optional file
                                                                filename = filenames.shift() ;
                                                                delete content.files[filename] ;
                                                                old_inner_path = old_user_path + filename ;
                                                                new_inner_path = new_user_path + filename ;
                                                                z_file_get(pgm, {inner_path: old_inner_path}, function (res, extra) {
                                                                    var json_raw ;
                                                                    json_raw = unescape(encodeURIComponent(res));
                                                                    z_file_write(pgm, new_inner_path, btoa(json_raw), {}, function (res) {
                                                                        var pgm = service + '.move_user_profile z_file_write callback 7b: ' ;
                                                                        if (res != 'ok') return cb2('cannot move user profile. ' + filename + ' fileWrite failed. res = ' + JSON.stringify(res)) ;
                                                                        // copy next optional file
                                                                        copy_optional_file() ;
                                                                    }) ; // z_file_write callback 7b
                                                                }) ; // z_file_get callback ?

                                                            } ; // copy_optional_file 10a
                                                            // start copy optional file loop
                                                            copy_optional_file() ;

                                                        }) ; // siteSign callback 9a

                                                    }) ; // z_file_write callback 8a

                                                }) ; // z_file_get callback 7a

                                            }) ; // siteSign callback 6a
                                            return ;
                                        }
                                        // path c: copy normal file
                                        filename = filenames.shift() ;
                                        delete content.files[filename] ;
                                        old_inner_path = old_user_path + filename ;
                                        new_inner_path = new_user_path + filename ;
                                        format = ['avatar.jpg', 'avatar.png'].indexOf(filename) != -1 ? 'base64' : 'text' ;
                                        z_file_get(pgm, {inner_path: old_inner_path, format: format}, function (res, extra) {
                                            var pgm = service + '.move_user_profile z_file_get callback 6c: ' ;
                                            var image_base64uri, json_raw, post_data ;
                                            // write file
                                            if (['avatar.jpg', 'avatar.png'].indexOf(filename) != -1) {
                                                // images
                                                image_base64uri = res ;
                                                post_data = image_base64uri != null ? image_base64uri.replace(/.*?,/, "") : void 0;
                                            }
                                            else {
                                                // json
                                                json_raw = unescape(encodeURIComponent(res));
                                                post_data = btoa(json_raw) ;
                                            }
                                            z_file_write(pgm, new_inner_path, post_data, {}, function (res) {
                                                var pgm = service + '.move_user_profile z_file_write callback 7c: ' ;
                                                if (res != 'ok') return cb2('cannot move user profile. ' + filename + ' fileWrite failed. res = ' + JSON.stringify(res)) ;
                                                // copy next file
                                                copy_normal_file() ;
                                            }) ; // z_file_write callback 7b

                                        }) ; // z_file_get callback 6b

                                    } ; // copy file callback 5
                                    // start copy file loop
                                    copy_normal_file() ;

                                }) ; // z_file_get callback 4

                            }) ; // siteSign callback 3

                        }) ; // get_my_user_hub callback 2

                    }) ; // mergerSiteList callback 1


                }) ;



            } // move_wallet_hub

            var get_my_wallet_hub_cbs = [] ; // callbacks waiting for query 17 to finish
            function get_my_wallet_hub (cb) {
                var pgm = service + '.get_my_wallet_hub: ' ;
                var wallet_data_hubs, step_1_wait_for_merger_permission, step_2_get_w3_wallet_data_hubs,
                    step_3_compare_json_and_files, step_4_find_wallet_hub, step_5_get_and_add_default_wallet_hub,
                    step_6_wallet_hub_selected, step_7_run_callbacks ;
                if (z_cache.my_wallet_data_hub == true) {
                    // get_my_wallet_hub request is already running. please wait
                    get_my_wallet_hub_cbs.push(cb) ;
                    return ;
                }
                if (z_cache.my_wallet_data_hub) return cb(z_cache.my_wallet_data_hub, z_cache.other_wallet_data_hub, z_cache.other_wallet_data_hub_title) ;
                z_cache.my_wallet_data_hub = true ;

                wallet_data_hubs = [] ;

                // setup callback chain step 1-7

                step_7_run_callbacks = function () {
                    // run callbacks. this and any pending callbacks
                    var pgm = service + '.get_my_wallet_hub.step_7_run_callbacks: ' ;
                    console.log(pgm + 'my_wallet_data_hub = ' + z_cache.my_wallet_data_hub + ', other_wallet_data_hub = ' + z_cache.other_wallet_data_hub) ;
                    cb(z_cache.my_wallet_data_hub, z_cache.other_wallet_data_hub, z_cache.other_wallet_data_hub_title) ;
                    while (get_my_wallet_hub_cbs.length) {
                        cb = get_my_wallet_hub_cbs.shift() ;
                        cb(z_cache.my_wallet_data_hub, z_cache.other_wallet_data_hub, z_cache.other_wallet_data_hub_title)
                    }
                }; // step_7_run_callbacks

                step_6_wallet_hub_selected = function () {
                    // wallet data hub was selected. find a random other wallet data hub. For wallet data hub lists. written to wallet.json file
                    var pgm = service + '.get_my_wallet_hub.step_6_wallet_hub_selected: ' ;
                    var i ;
                    var other_wallet_data_hubs ;
                    if (wallet_data_hubs.length <= 1) {
                        z_cache.other_wallet_data_hub = z_cache.my_wallet_data_hub ;
                        delete z_cache.other_wallet_data_hub_title ;
                        return step_7_run_callbacks() ;
                    }
                    other_wallet_data_hubs = [] ;
                    for (i=0 ; i<wallet_data_hubs.length ; i++) {
                        if (wallet_data_hubs[i].hub != z_cache.my_wallet_data_hub) other_wallet_data_hubs.push(wallet_data_hubs[i]) ;
                    }
                    if (!other_wallet_data_hubs.length) {
                        // debug info. trying to fix a JS error
                        console.log(pgm + 'error. expected ' + (wallet_data_hubs.length-1) + ' other_wallet_data_hubs') ;
                        console.log(pgm + 'my_wallet_hub = ' + z_cache.my_wallet_data_hub) ;
                        console.log(pgm + 'wallet_data_hubs = ' + JSON.stringify(wallet_data_hubs)) ;
                        // fix system error
                        z_cache.other_wallet_hub = z_cache.my_wallet_data_hub ;
                        delete z_cache.other_wallet_data_hub_title ;
                        return step_7_run_callbacks() ;
                    }
                    i = Math.floor(Math.random() * other_wallet_data_hubs.length);
                    if (!other_wallet_data_hubs[i]) {
                        // debug info. trying to fix a JS error
                        console.log(pgm + 'error. expected i between 0 and ' + ( other_wallet_data_hubs.length-1)) ;
                        console.log(pgm + 'i = ' + i + ', other_wallet_data_hubs.length = ' + other_wallet_data_hubs.length) ;
                        // fix system error
                        z_cache.other_wallet_data_hub = z_cache.my_wallet_data_hub ;
                        delete z_cache.other_wallet_data_hub_title ;
                        return step_7_run_callbacks() ;
                    }
                    z_cache.other_wallet_data_hub = other_wallet_data_hubs[i].hub ; // = data.json hub
                    z_cache.other_wallet_data_hub_title = other_wallet_data_hubs[i].title ; // = data.json hub_title
                    return step_7_run_callbacks() ;
                }; // step_6_wallet_hub_selected

                // normally never used. default_hubs should be in wallet_data_hubs array (from get_all_hubs call)
                step_5_get_and_add_default_wallet_hub = function () {
                    var pgm = service + '.get_my_wallet_hub.step_5_get_and_add_default_wallet_hub: ' ;
                    var my_wallet_hub ;
                    // no wallet_data_hubs (no merger site hubs were found)
                    my_wallet_hub = get_default_wallet_hub() ;
                    console.log(pgm + 'calling mergerSiteAdd with my_wallet_hub = ' + my_wallet_hub.hub) ;

                    MoneyNetworkAPILib.z_merger_site_add(my_wallet_hub.hub, function (res) {
                        var pgm = service + '.get_my_wallet_hub.step_5_get_and_add_default_wallet_hub z_merger_site_add callback: ' ;
                        console.log(pgm + 'res = '+ JSON.stringify(res));
                        if (res == 'ok') {
                            z_cache.my_wallet_data_hub = my_wallet_hub.hub ;
                            z_cache.my_wallet_data_hub_title = my_wallet_hub.hub_title ;
                            wallet_data_hubs.push(my_wallet_hub) ;
                            step_6_wallet_hub_selected() ;
                            return ;
                        }
                        console.log(pgm + 'mergerSiteAdd failed. hub = ' + JSON.stringify(my_wallet_hub) + '. error = ' + res) ;

                    }) ; // z_merger_site_add callback

                }; // step_5_get_and_add_default_wallet_hub

                step_4_find_wallet_hub = function () {
                    var pgm = service + '.get_my_wallet_hub.step_4_find_wallet_hub: ';
                    var w3_query_2, debug_seq1, i ;

                    if (!wallet_data_hubs.length) {
                        console.log(pgm + 'wallet_data_hubs array is empty!') ;
                        return step_5_get_and_add_default_wallet_hub() ;
                    }

                    // find wallet data hub for current user
                    // - wallet.json file must exist
                    // - wallet.wallet_address = this site
                    // - latest updated content.json is being used
                    w3_query_2 =
                        "select substr(wallet.directory, 1, instr(wallet.directory,'/')-1) as hub " +
                        "from keyvalue as wallet_address, json as wallet, json as content, keyvalue as modified " +
                        "where wallet_address.key = 'wallet_address' " +
                        "and wallet_address.value = '" + ZeroFrame.site_info.address + "' " +
                        "and wallet.json_id = wallet_address.json_id " +
                        "and wallet.directory in " ;
                    for (i=0 ; i<wallet_data_hubs.length ; i++) {
                        w3_query_2 += (i == 0 ? "('" : ",'") + wallet_data_hubs[i].hub + '/data/users/' + ZeroFrame.site_info.auth_address + "'" ;
                    }
                    w3_query_2 += ") " +
                        "and content.directory = wallet.directory " +
                        "and content.file_name = 'content.json' " +
                        "and modified.json_id = content.json_id " +
                        "and modified.key = 'modified' " +
                        "order by modified.value desc" ;

                    console.log(pgm + 'w3 query 2 = ' + w3_query_2);
                    debug_seq1 = MoneyNetworkAPILib.debug_z_api_operation_start(pgm, 'w3 query 2', 'dbQuery') ;
                    ZeroFrame.cmd("dbQuery", [w3_query_2], function (res) {
                        var pgm = service + '.get_my_wallet_hub.step_4_find_wallet_hub dbQuery callback 1: ';
                        var i, cleanup_old_wallet_hub, priorities, min_priority, priority;
                        MoneyNetworkAPILib.debug_z_api_operation_end(debug_seq1, (!res || res.error) ? 'Failed. error = ' + JSON.stringify(res) : 'OK. Returned ' + res.length + ' rows');

                        if (res.error) {
                            console.log(pgm + "wallet data hub lookup failed: " + res.error);
                            console.log(pgm + 'w3 query 2 = ' + w3_query_2);
                            return step_5_get_and_add_default_wallet_hub() ;
                        }
                        if (res.length > 1) {
                            // user profile on more than one wallet data hub. delete content in older wallets before continue with latest updated wallet data hub
                            console.log(pgm + 'found user profile on more that one wallet data hub. res = ' + JSON.stringify(res)) ;
                            cleanup_old_wallet_hub = function() {
                                var hub ;
                                if (res.length == 1) return ; // done deleting old wallet data hubs
                                hub = res[res.length-1].hub ;
                                res.pop() ;
                                cleanup_wallet_hub(hub, function (res) {
                                    console.log(pgm + 'deleted old wallet data hub ' + hub + '. res = ' + JSON.stringify(res)) ;
                                    cleanup_old_wallet_hub() ;
                                }) ;
                            }; // delete_old_wallet_hub
                            // start cleanup loop. continue anyway. publish operations can take some time (max one publish operation every 30 seconds)
                            cleanup_old_wallet_hub() ;
                        }
                        if (res.length == 1) {
                            // old wallet
                            z_cache.my_wallet_data_hub = res[0].hub ; // return hub for last updated content.json
                            return step_6_wallet_hub_selected() ;
                        }


                        // no wallet was found. must be a new user
                        // new user. select random wallet data hub from available hubs
                        console.log(pgm + 'wallet_data_hubs = ' + JSON.stringify(wallet_data_hubs)) ;
                        //priority_texts = {
                        //    "1": 'existing hub with peers. always ok',
                        //    "2": 'just added hub waiting for peers. may or may not fail',
                        //    "3": 'new hub. maybe or maybe not be a hub with peers',
                        //    "4": 'existing hub without peers. will always fail',
                        //    "5": 'last mergerSiteAdd failed. unavailable hub'
                        //};
                        priorities = [] ; // arrays for priorities
                        // wallet_data_hubs = [{"hub":"182Uot1yJ6mZEwQYE5LX1P5f6VPyJ9gUGe"},{"hub":"1PgyTnnACGd1XRdpfiDihgKwYRRnzgz2zh"}]
                        min_priority = 999 ;
                        for (i=0 ; i<wallet_data_hubs.length ; i++) {
                            priority = wallet_data_hubs[i].priority ;
                            while (priorities.length < priority+1) priorities.push([]) ;
                            priorities[priority].push(i) ;
                            if (priority < min_priority) min_priority = priority ;
                        }
                        console.log(pgm + 'using priority ' + min_priority + ' for hub selecting. found ' + priorities[min_priority].length + ' hub(s) with priority ' + min_priority) ;
                        // using priority 3 for hub selecting. found 2 hub(s) with priority 3

                        // select random hub
                        i = Math.floor(Math.random() * priorities[min_priority].length);
                        i = priorities[min_priority][i] ;
                        console.log(pgm + 'selected user data hub ' + wallet_data_hubs[i].hub + ' with priority ' + wallet_data_hubs[i].priority + ' ' + wallet_data_hubs[i].priority_text) ;
                        z_cache.my_wallet_data_hub = wallet_data_hubs[i].hub ; // = hub in data.json
                        z_cache.my_wallet_data_hub_title = wallet_data_hubs[i].title ; // = hub_title in data_json
                        console.log(pgm + 'hub = ' + z_cache.my_wallet_data_hub) ;
                        console.log(pgm + 'hub_title = ' + z_cache.my_wallet_data_hub_title) ;

                        if (wallet_data_hubs[i].hub_added) step_6_wallet_hub_selected() ;
                        else {
                            console.log(pgm + 'adding new wallet data hub ' + z_cache.my_wallet_data_hub) ;
                            MoneyNetworkAPILib.z_merger_site_add(z_cache.my_wallet_data_hub, function (res) {
                                var pgm = service + '.get_my_wallet_hub.step_4_find_wallet_hub z_merger_site_add callback 2: ';
                                if (res != 'ok') console.log(pgm + 'error. mergerSiteAdd ' + z_cache.my_wallet_data_hub + ' failed. res = ' + JSON.stringify(res)) ;
                                step_6_wallet_hub_selected() ;
                            }); // z_merger_site_add callback 2
                        }

                    }) ; // dbQuery callback 1

                }; // step_4_find_wallet_hub

                // compare "json" and "files" tables before running w3_query_2 in step_4_find_wallet_hubs. Should be identical. files table is no longer used in w3_query_2
                step_3_compare_json_and_files = function () {
                    var pgm = service + '.get_my_wallet_hub.step_3_compare_json_and_files: ' ;
                    var w3_query_9, debug_seq1 ;

                    // with operator not supported. one query for each table (json and files)
                    // 1: get json rows
                    w3_query_9 =
                        "select directory, file_name," +
                        "   (select value from keyvalue " +
                        "    where keyvalue.json_id = json.json_id " +
                        "    and keyvalue.key = 'modified') as modified " +
                        "from json " +
                        "where json.directory like '%/" + ZeroFrame.site_info.auth_address + "' " ;
                    console.log(pgm + 'mn query 9 = ' + w3_query_9) ;
                    debug_seq1 = MoneyNetworkAPILib.debug_z_api_operation_start(pgm, 'w3 query 9', 'dbQuery') ;
                    ZeroFrame.cmd("dbQuery", [w3_query_9], function (res1) {
                        var pgm = service + '.get_my_wallet_hub.step_3_compare_json_and_files dbQuery callback 1: ';
                        var w3_query_10, debug_seq2, res, i, index, indexed_by_modified ;
                        MoneyNetworkAPILib.debug_z_api_operation_end(debug_seq1, (!res1 || res1.error) ? 'Failed. error = ' + JSON.stringify(res1) : 'OK');
                        if (res1.error) {
                            console.log(pgm + "json and files compare failed: " + res1.error);
                            console.log(pgm + 'w3 query 9 = ' + w3_query_9);
                            return step_4_find_wallet_hub() ;
                        }
                        res = {} ;
                        indexed_by_modified = {} ;
                        for (i=0 ; i<res1.length ; i++) {
                            if (res1[i].file_name == 'content.json') {
                                indexed_by_modified[res1[i].modified] = res1[i].directory ;
                            }
                            else {
                                index = res1[i].directory + '/' + res1[i].file_name ;
                                res[index] = {
                                    directory: res1[i].directory,
                                    file_name: res1[i].file_name,
                                    in_json: true
                                } ;
                            }
                        }
                        // console.log(pgm + 'indexed_by_modified = ' + JSON.stringify(indexed_by_modified));

                        // 2: get files rows
                        w3_query_10 =
                            "select json.directory, files.filename as file_name from files, json " +
                            "where json.directory like '%/" + ZeroFrame.site_info.auth_address + "' " +
                            "and json.json_id = files.json_id" ;
                        console.log(pgm + pgm + 'w3 query 10 = ' + w3_query_10) ;
                        debug_seq2 = MoneyNetworkAPILib.debug_z_api_operation_start(pgm, 'mn query 19', 'dbQuery') ;
                        ZeroFrame.cmd("dbQuery", [w3_query_10], function (res2) {
                            var pgm = service + '.get_my_wallet_hub.step_3_compare_json_and_files dbQuery callback 2: ';
                            var i, index, hub, missing_rows, dictionaries, modified, sign, wallet_data_hub ;
                            MoneyNetworkAPILib.debug_z_api_operation_end(debug_seq2, (!res2 || res2.error) ? 'Failed. error = ' + JSON.stringify(res2) : 'OK');
                            if (res2.error) {
                                console.log(pgm + "json and files compare failed: " + res2.error);
                                console.log(pgm + 'w3 query 10 = ' + w3_query_10);
                                return step_4_find_wallet_hub();
                            }
                            for (i=0 ; i<res2.length ; i++) {
                                index = res2[i].directory + '/' + res2[i].file_name ;
                                if (res[index]) res[index].in_files = true ;
                                else res[index] =  {
                                    directory: res2[i].directory,
                                    file_name: res2[i].file_name,
                                    in_files: true
                                } ;
                            }

                            missing_rows = [] ;
                            for (index in res) {
                                if (res[index].in_json && res[index].in_files) continue ;
                                if (['avatar.jpg','avatar.png'].indexOf(res[index].file_name) != -1) continue ; // minor dif
                                hub = index.substr(0,index.indexOf('/')) ;
                                wallet_data_hub = false ;
                                for (i=0 ; i<wallet_data_hubs.length ; i++) {
                                    if ((wallet_data_hubs[i].hub == hub) && !wallet_data_hubs[i].hub_added_at) {
                                        wallet_data_hub = true ;
                                        break ;
                                    }
                                }
                                if (!wallet_data_hub) continue ; // ignore - not a W3 wallet Data Hub - also ignore just added W3 wallet Data Hubs
                                missing_rows.push(res[index]) ;
                            }
                            if (!missing_rows.length) return step_4_find_wallet_hub() ; // everything is OK. next step

                            // inconsistency between json and files!
                            console.log(pgm + 'warning. difference between json and files rows. could be missing sign or manuel deleted files. signing content.json files in modified order to fix this') ;
                            console.log(pgm + 'res = ' + JSON.stringify(res)) ;
                            console.log(pgm + 'missing_rows = ' + JSON.stringify(missing_rows)) ;

                            // rules:
                            // - always sign directories without content.json / without modified timestamp first
                            // - always sign last changed content.json last
                            // - minimum one second between each sign to keep modified sequence
                            dictionaries = [] ;
                            for (modified in indexed_by_modified) dictionaries.push(indexed_by_modified[modified]) ;
                            for (i=0 ; i<missing_rows.length ; i++) {
                                if (dictionaries.indexOf(missing_rows[i].directory) !=-1) continue ;
                                dictionaries.unshift(missing_rows[i].directory) ;
                            }
                            console.log(pgm + 'dictionaries = ' + JSON.stringify(dictionaries)) ;

                            // loop. sign each content.json file (remove files_optional and add optional)
                            sign = function () {
                                var pgm = service + '.get_my_wallet_hub.step_3_compare_json_and_files.sign: ';
                                var dictionary, hub, inner_path  ;
                                dictionary = dictionaries.shift() ;
                                hub = dictionary.substr(0,dictionary.indexOf('/')) ;
                                console.log(pgm + 'dictionary = ' + dictionary + ', hub = ' + hub) ;
                                // 1: read content.json
                                inner_path = 'merged-' + get_merged_type() + '/' + dictionary + '/content.json' ;

                                z_file_get(pgm, {inner_path: inner_path, required: true}, function (content_str) {
                                    var pgm = service + '.get_my_wallet_hub.step_3_compare_json_and_files.sign z_file_get callback 1: ';
                                    var content, json_raw, debug_seq1 ;
                                    if (content_str) {
                                        try {
                                            content = JSON.parse(content_str) ;
                                        }
                                        catch (e) {
                                            console.log(pgm + 'ignoring invalid content.json. error = ' + e.message) ;
                                            content = {} ;
                                        }
                                    }
                                    else content = {} ;
                                    content.optional = Z_CONTENT_OPTIONAL ;

                                    // 2: write content.json
                                    json_raw = unescape(encodeURIComponent(JSON.stringify(content)));
                                    z_file_write(pgm, inner_path, btoa(json_raw), {}, function (res) {
                                        var pgm = service + '.get_my_wallet_hub.step_3_compare_json_and_files.sign fileWrite callback 2: ';
                                        var debug_seq2 ;
                                        if (res != 'ok') {
                                            console.log(pgm + 'Error: ' + inner_path + ' fileWrite failed. res = ' + JSON.stringify(res));
                                            return step_4_find_wallet_hub() ; // error - continue with next step
                                        }
                                        // 3: sign
                                        // debug_seq2 = MoneyNetworkHelper.debug_z_api_operation_start('z_site_publish', pgm + inner_path + ' sign') ;
                                        debug_seq2 = MoneyNetworkAPILib.debug_z_api_operation_start(pgm, inner_path, 'siteSign') ;
                                        ZeroFrame.cmd("siteSign", {inner_path: inner_path, remove_missing_optional: true}, function (res) {
                                            var pgm = service + '.get_my_wallet_hub.step_3_compare_json_and_files.sign siteSign callback 3: ';
                                            // MoneyNetworkHelper.debug_z_api_operation_end(debug_seq2);
                                            MoneyNetworkAPILib.debug_z_api_operation_end(debug_seq2, res);
                                            if (res != 'ok') {
                                                console.log(pgm + inner_path + ' siteSign failed. error = ' + JSON.stringify(res));
                                                return step_4_find_wallet_hub() ; // error - continue with next step;
                                            }

                                            // sign ok
                                            if (!dictionaries.length) return step_4_find_wallet_hub() ; // done - continue with next step
                                            // next sign in 1 second to keep content.json modified sequence
                                            setTimeout(sign, 1000) ;

                                        }) ; // siteSign callback 3

                                    }) ; // fileWrite callback 2

                                }) ; // z_file_get callback 1

                            } ; // sign

                            // start sign loop
                            sign() ;

                        }) ; // dbQuery callback 2

                    }) ; // dbQuery callback 1

                } ; // step_3_compare_json_and_files

                // step 2 : get a list of W3 wallet data hubs. title or description matches /w3 /i. used for new W3 users
                step_2_get_w3_wallet_data_hubs = function() {
                    var pgm = service + '.get_my_wallet_hub.step_2_get_w3_wallet_data_hubs: ' ;
                    // get a list of MN wallet data hubs
                    // merger sites with title starting with W3
                    MoneyNetworkAPILib.get_all_hubs(false, function (all_hubs) {
                        var pgm = service + '.get_my_wallet_hub.step_2_get_w3_wallet_data_hubs get_all_hubs callback 1: ';
                        var  i;
                        wallet_data_hubs = [];
                        for (i = 0; i < all_hubs.length; i++) {
                            if (all_hubs[i].hub_type == 'user') continue;
                            if (!all_hubs[i].hub_title) continue ;
                            if (all_hubs[i].hub_title.match(/^W3 /i)) wallet_data_hubs.push(all_hubs[i]);
                        }
                        console.log(pgm + 'wallet_data_hubs = ' + JSON.stringify(wallet_data_hubs));
                        // next step
                        step_3_compare_json_and_files() ;
                    }) ;
                }; // step_2_get_w3_wallet_data_hubs

                // step 1 : only first contact. wait for merger permission before calling MoneyNetworkAPILib.get_all_hubs
                step_1_wait_for_merger_permission = function() {
                    if (ZeroFrame.site_info &&
                        ZeroFrame.site_info.settings &&
                        ZeroFrame.site_info.settings.permissions &&
                        (ZeroFrame.site_info.settings.permissions.indexOf("Merger:MoneyNetwork") != -1)) {
                        // everything is OK. ZeroFrame ready and merger permission has been granted
                        console.log(pgm + 'merger permission OK. continue with step_2_get_w3_wallet_data_hubs') ;
                        return step_2_get_w3_wallet_data_hubs() ;
                    }
                    // wait
                    console.log(pgm + 'waiting for ZeroFrame or merger permission') ;
                    $timeout(step_1_wait_for_merger_permission, 1000) ;
                } ; // step_1_wait_for_merger_permission

                // start callback chain step 1-7
                step_1_wait_for_merger_permission() ;

            } // get_my_wallet_hub

            function get_merged_type () {
                return MoneyNetworkAPILib.get_merged_type() ;
            }

            // return special merger site path
            var get_user_path_cbs = [] ;
            function get_user_path (cb) {
                var pgm = service + '.user_path: ' ;
                if (!ZeroFrame.site_info) throw pgm + "invalid call. ZeroFrame is not finish loading" ;
                if (!ZeroFrame.site_info.cert_user_id) throw pgm + "invalid call. ZeroId is missing" ;
                if (z_cache.user_path == true) {
                    // wait for previous user_path request to finish
                    get_user_path_cbs.push(cb) ;
                    return ;
                }
                if (z_cache.user_path) return cb(z_cache.user_path) ; // OK
                z_cache.user_path = true ;
                get_my_wallet_hub(function (my_hub, other_wallet_data_hub, other_wallet_data_hub_title) {
                    z_cache.user_path = 'merged-' + get_merged_type() + '/' + my_hub + '/data/users/' + ZeroFrame.site_info.auth_address + '/' ;
                    MoneyNetworkAPILib.config({this_user_path: z_cache.user_path}) ;
                    cb(z_cache.user_path);
                    while (get_user_path_cbs.length) { cb = get_user_path_cbs.shift() ; cb(z_cache.user_path)}
                }) ;
            } // get_user_path

            // initialize. delete old status.json file - no longer needed
            function delete_status_json (cb) {
                var pgm = service + '.delete_status_json: ' ;
                get_my_wallet_hub(function (my_hub, other_wallet_data_hub, other_wallet_data_hub_title) {
                    var pgm = service + '.delete_status_json get_my_wallet_hub callback 1: ' ;
                    var directory, w3_query_8, debug_seq ;
                    directory = my_hub + '/data/users/' + ZeroFrame.site_info.auth_address ;
                    w3_query_8 =
                        "select 1 from json, files " +
                        "where json.directory = '" + directory + "' " +
                        "and json.file_name = 'content.json' " +
                        "and files.json_id = json.json_id " +
                        "and files.filename = 'status.json'" ;
                    console.log(pgm + 'w3_query_8 = ' + w3_query_8) ;
                    debug_seq = MoneyNetworkAPILib.debug_z_api_operation_start(pgm, 'w3_query_8', 'dbQuery') ;
                    ZeroFrame.cmd("dbQuery", [w3_query_8], function (res) {
                        var pgm = service + '.delete_status_json dbQuery callback 2: ';
                        MoneyNetworkAPILib.debug_z_api_operation_end(debug_seq, (!res || res.error) ? 'Failed. error = ' + JSON.stringify(res) : 'OK. Returned ' + res.length + ' rows');
                        // console.log(pgm + 'res = ' + JSON.stringify(res)) ;
                        if (!res || res.error) {
                            console.log(pgm + 'status.json query failed. res = ' + JSON.stringify(res));
                            console.log(pgm + 'w3_query_8 = ' + w3_query_8);
                            return cb() ;
                        }
                        if (!res.length) return cb() ; // already deleted
                        get_user_path(function (my_user_path) {
                            var pgm = service + '.delete_status_json get_user_path callback 3: ';
                            var inner_path ;
                            inner_path = my_user_path + 'status.json' ;
                            MoneyNetworkAPILib.z_file_delete(pgm, inner_path, function (res) {
                                var pgm = service + '.delete_status_json z_file_delete callback 4: ';
                                if (res == 'ok') {
                                    // status.json was deleted. sign change
                                    z_publish({reason: inner_path}, function() {
                                        cb()
                                    }) ;
                                }
                                else {
                                    console.log(pgm + 'delete status.json failed. res = ' + JSON.stringify(res)) ;
                                    cb() ;
                                }
                            }) ; // z_file_delete callback 4

                        }) ; // get_user_path callback 3

                    }) ; // dbQuery callback 2

                }) ; // get_my_wallet_hub callback 1

            } // delete_status_json

            // sign or publish
            var z_publish_interval = 0 ;
            var z_publish_pending = false ;
            var z_site_publish_no_peers = false ;

            function z_publish(options, cb) {
                var pgm = service + '.z_publish: ';
                var pgm2, publish, group_debug_seq, reason, inner_path;
                if (status.restoring) return ; // restoring backup
                if (!options) options = {};
                publish = options.publish;
                group_debug_seq = options.group_debug_seq;
                if (options.reason) reason = options.reason ;
                pgm2 = MoneyNetworkAPILib.get_group_debug_seq_pgm(pgm, group_debug_seq);
                if (!cb) cb = function () {};
                // get full merger site user path
                get_user_path(function (user_path) {
                    var pgm = service + '.z_publish get_user_path callback 1: ';
                    var cmd;
                    inner_path = user_path + 'content.json';
                    if (publish) console.log(pgm + 'publishing ' + inner_path);
                    // content.json file must have optional files support
                    encrypt1.add_optional_files_support({group_debug_seq: group_debug_seq}, function () {
                        var pgm = service + '.z_publish add_optional_files_support callback 2: ';
                        var debug_seq;

                        // sign or publish
                        cmd = publish ? 'sitePublish' : 'siteSign';
                        if (publish) {
                            // use MN publish queue. max one publish once every 30 seconds to prevent ratelimit errors (false OK publish)
                            MoneyNetworkAPILib.z_site_publish({inner_path: inner_path, remove_missing_optional: true, encrypt: encrypt2, reason: reason}, function (res) {
                                var pgm = service + '.z_publish z_site_publish callback 3a: ';
                                var pgm2;
                                pgm2 = MoneyNetworkAPILib.get_group_debug_seq_pgm(pgm, group_debug_seq);
                                console.log(pgm2 + 'res = ' + JSON.stringify(res));
                                if (res != "ok") {

                                    // run callback. depending on condition the code will either retry publish or ask user to move user profile to an other user data hub
                                    cb(res);

                                    // https://github.com/jaros1/Money-Network/issues/321 Publish failed - no peers
                                    // publish failed. check number of peers for current user data hub
                                    // refresh list of user data hubs. user may have to move user profile to an other user data hub
                                    MoneyNetworkAPILib.get_all_hubs(true, function (all_hubs) {
                                        var pgm = service + '.z_publish get_all_hubs callback 4a: ';
                                        var i, peers, msg, wallet_data_hubs, hub, new_wallet_hub ;

                                        // any peers serving my_wallet_data_hub?
                                        peers = true ;
                                        for (i=0 ; i<all_hubs.length ; i++) {
                                            if (all_hubs[i].hub != z_cache.my_wallet_data_hub) continue ;
                                            if (all_hubs[i].hasOwnProperty('peers') && (all_hubs[i].peers < 2)) peers = false ;
                                            console.log(pgm + 'publish failed. found ' + all_hubs[i].peers + ' peers for ' + all_hubs[i].hub) ;
                                        }

                                        if (peers) {
                                            // publish failed. unknown reason (internet offline, vpn problem, ZeroNet port problem)
                                            z_wrapper_notification(["error", "Failed to publish: " + res.error, 5000]);

                                            // retry sitePublish in 30, 60, 120, 240 etc seconds (device maybe offline or no peers)
                                            if (!z_publish_interval) z_publish_interval = 30;
                                            else z_publish_interval = z_publish_interval * 2;
                                            console.log(pgm2 + 'Error. Failed to publish: ' + res.error + '. Try again in ' + z_publish_interval + ' seconds');
                                            var retry_zeronet_site_publish = function () {
                                                z_publish({publish: publish, reason: reason, group_debug_seq: group_debug_seq}, cb);
                                            };
                                            $timeout(retry_zeronet_site_publish, z_publish_interval * 1000);

                                        }
                                        else {
                                            // publish failed. No peers for my_wallet_data_hub

                                            // any user data hubs with peers?
                                            wallet_data_hubs = [] ;
                                            for (i=0 ; i<all_hubs.length ; i++) {
                                                if (all_hubs[i].hub_type != 'wallet') continue ;
                                                if (!all_hubs[i].hub_added) continue ;
                                                if (!all_hubs[i].hub_title) continue ;
                                                if (!all_hubs[i].hub_title.match(/^W3 /i)) continue;
                                                if (all_hubs[i].hub == z_cache.my_wallet_data_hub) continue ;
                                                if (all_hubs[i].peers >= 2) wallet_data_hubs.push(all_hubs[i].hub) ;
                                            }
                                            if (!wallet_data_hubs.length) {
                                                // no wallet data hubs with peers.
                                                msg = [
                                                    "Failed to publish: " + res.error,
                                                    'No peers were found for wallet data hub' + z_cache.my_wallet_data_hub,
                                                    'No other wallet data hubs with peers were found',
                                                    'Please add more wallet data hubs',
                                                    'Please select user profile hub'
                                                ] ;
                                                console.log(pgm + msg.join('. ')) ;
                                                z_wrapper_notification(["error", msg.join('<br>')]);
                                                new_wallet_hub = null ;

                                            }
                                            else if (wallet_data_hubs.length == 1) {
                                                // one user data hub with peers. move user profile
                                                msg = [
                                                    "Failed to publish: " + res.error,
                                                    'No peers were found for wallet data hub' + z_cache.my_wallet_data_hub,
                                                    'Moving user profile to ' + wallet_data_hubs[0]
                                                ] ;
                                                console.log(pgm + msg.join('. ')) ;
                                                z_wrapper_notification(["error", msg.join('<br>')]);
                                                new_wallet_hub = wallet_data_hubs[0].hub ;

                                            }
                                            else {
                                                // more user data hubs with peers. Select random or ask user to select user data hub in Account page
                                                msg = [
                                                    "Failed to publish: " + res.error,
                                                    'No peers were found for wallet data hub' + z_cache.my_wallet_data_hub,
                                                    'You should move your user profile to an other wallet data hub',
                                                    'Press OK to confirm box or change default user data hub'] ;
                                                console.log(pgm + msg.join('. ')) ;
                                                z_wrapper_notification(["error", msg.join('<br>')]);
                                                i = Math.floor(Math.random() * wallet_data_hubs.length) ;
                                                new_wallet_hub = wallet_data_hubs[i].hub ;

                                            }

                                            // confirm box - move user profile - user may want to create a backup before moving user profile
                                            if (!z_site_publish_no_peers && new_wallet_hub) {
                                                // confirm box. offer the user as easy workaround for publish failed and no peers
                                                z_site_publish_no_peers = true ;
                                                msg = [
                                                    'Moving user profile',
                                                    'from ' + z_cache.my_wallet_data_hub,
                                                    'to ' + new_wallet_hub,
                                                    'You may want to create a export/backup before continuing',
                                                    'Any MN-wallet sessions must be reconnected after move',
                                                    'Any ongoing money transaction must be restarted after move',
                                                    'Move user profile?'] ;
                                                ZeroFrame.cmd("wrapperConfirm", [msg.join('<br>'), 'OK'], function (confirm) {
                                                    var pgm = service + '.zeronet_site_publish wrapperConfirm callback 7: ';
                                                    if (!confirm) return ;

                                                    z_wrapper_notification(['info', 'Moving user profile<br>Please wait for receipt<br>Publish operations can take some time', 20000]) ;

                                                    move_user_profile(new_wallet_hub, function (res) {
                                                        var pgm = service + '.zeronet_site_publish wrapperConfirm callback 8: ';
                                                        var msg ;
                                                        if (res) {
                                                            msg = [
                                                                'Move user profile failed',
                                                                'res = ' + JSON.stringify(res) +
                                                                'You may want to log out + log in to cleanup files',
                                                                'You may want to import backup (Account page)'
                                                            ] ;
                                                            console.log(pgm + msg.join('. ')) ;
                                                            z_wrapper_notification(['error', msg.join('<br>')]) ;
                                                        }
                                                        else {
                                                            msg = [
                                                                'User profile was moved',
                                                                'Any old MN-wallet sessions must be reconnected'
                                                            ] ;
                                                            z_wrapper_notification(['done', msg.join('<br>')]) ;
                                                        }

                                                    }) ; // move_user_hub callback 8

                                                }); // wrapperConfirm callback 7
                                            }

                                        }

                                    }) ; // get_all_hubs callback 6
                                    // publish failed
                                    return;
                                }
                                // sign/publish OK
                                z_publish_interval = 0;
                                z_publish_pending = false ;
                                cb(res);
                            }); // z_site_publish callback 3a
                            return;
                        }
                        // sign only. fast operation
                        debug_seq = MoneyNetworkAPILib.debug_z_api_operation_start(pgm, inner_path, cmd, null, group_debug_seq);
                        ZeroFrame.cmd(cmd, {inner_path: inner_path, remove_missing_optional: true}, function (res) {
                            var pgm = service + '.z_publish ' + cmd + ' callback 4: ';
                            var pgm2;
                            pgm2 = MoneyNetworkAPILib.get_group_debug_seq_pgm(pgm, group_debug_seq);
                            MoneyNetworkAPILib.debug_z_api_operation_end(debug_seq, res == 'ok' ? 'OK' : 'Failed. error = ' + JSON.stringify(res));
                            console.log(pgm2 + 'res = ' + res);
                            if (res != "ok") {
                                z_wrapper_notification(["error", "Failed to " + (publish ? "publish" : "sign") + ": " + res.error, 5000]);
                                return cb(res.error); // sign only. must be a serious error
                            }
                            // sign OK
                            z_publish_pending = true;
                            cb(res);

                        }); // sitePublish callback 4

                    }); // add_optional_files_support callback 2

                }); // get_user_path callback 1

            } // z_publish

            // inject wallet z_publish function into MoneyNetworkAPILib. used for waiting_for_file notifications (hanging fileGet operations)
            function waiting_for_file_publish (request_filename) {
                if (status.restoring) return ; // restoring backup
                z_publish({publish: true, reason: (request_filename ? request_filename : 'waiting_for_file')}) ;
            }
            MoneyNetworkAPILib.config({waiting_for_file_publish: waiting_for_file_publish}) ;

            function run_pending_publish (reason, cb) {
                var pgm = service + '.run_pending_publish: ' ;
                if (!cb) cb = function() {} ;
                if (!z_publish_pending) return ;
                z_publish({publish: true, reason: reason}, function (res) {
                    cb(res) ;
                }) ;
            } // run_pending_publish

            var get_content_json_cbs = [] ; // callbacks waiting for first get_content_json request to finish
            function get_content_json (cb) {
                var pgm = service + '.get_content_json: ' ;
                if (z_cache.content_json == true) return get_content_json_cbs.push(cb) ; // wait for first get_content_json request to finish
                if (z_cache.content_json) return cb(z_cache.content_json) ; // wallet.json is already in cache
                z_cache.content_json = true ;
                get_user_path(function (user_path) {
                    var inner_path ;
                    inner_path = user_path + 'content.json' ;
                    z_file_get(pgm, {inner_path: inner_path, required: false}, function (content_str) {
                        var content ;
                        if (!content_str) content = {} ;
                        else {
                            try {content = JSON.parse(content_str) }
                            catch (e) {
                                console.log(pgm + inner_path + ' was invalid. content_str = ' + content_str + ', error = ' + e.message) ;
                                content = {} ;
                            }
                        }
                        z_cache.content_json = content ;
                        cb(z_cache.content_json) ;
                        while (get_content_json_cbs.length) { cb = get_content_json_cbs.shift() ; cb(z_cache.content_json)} ;
                    }) ; // z_file_get callback 2
                }) ; // get_user_path callback 1
            } // get_content_json

            function write_content_json(cb) {
                var pgm = service + '.write_content_json: ';
                var inner_path, data, json_raw, debug_seq;
                data = z_cache.content_json || {};
                json_raw = unescape(encodeURIComponent(JSON.stringify(data, null, "\t")));
                get_user_path(function (user_path) {
                    var pgm = service + '.write_content_json get_user_path callback 1: ';
                    var inner_path, debug_seq ;
                    inner_path = user_path + 'content.json' ;
                    // console.log(pgm + 'calling fileWrite. path = ' + inner_path) ;
                    debug_seq = MoneyNetworkAPILib(pgm, inner_path, 'fileWrite') ;
                    z_file_write(pgm, inner_path, btoa(json_raw), {}, function (res) {
                        var pgm = service + '.write_content_json fileWrite callback 2: ';
                        MoneyNetworkAPILib.debug_z_api_operation_end(debug_seq, res == 'ok' ? 'OK' : 'Failed. error = ' + JSON.stringify(res));
                        console.log(pgm + 'res = ' + JSON.stringify(res)) ;
                        cb(res);
                    }); // fileWrite callback 2
                }) ; // get_user_path callback 2
            } // write_content_json

            var get_wallet_json_cbs = [] ; // callbacks waiting for first get_wallet_json request to finish
            function get_wallet_json(cb) {
                var pgm = service + '.get_wallet_json: ';
                if (z_cache.wallet_json == true) return get_wallet_json_cbs.push(cb); // wait for first get_wallet_json request to finish
                if (z_cache.wallet_json) return cb(z_cache.wallet_json); // wallet.json is already in cache
                z_cache.wallet_json = true;
                get_user_path(function (user_path) {
                    var pgm = service + '.get_wallet_json get_user_path callback 1: ';
                    var inner_path;
                    inner_path = user_path + 'wallet.json';
                    z_file_get(pgm, {inner_path: inner_path, required: false}, function (wallet_str, extra) {
                        var pgm = service + '.get_wallet_json z_file_get callback 2: ';
                        var wallet;
                        if (!wallet_str) {
                            console.log(pgm + 'wallet.json was not found. extra = ' + JSON.stringify(extra));
                            wallet = {};
                        }
                        else {
                            extra = {};
                            try {
                                wallet = JSON.parse(wallet_str);
                            }
                            catch (e) {
                                console.log(pgm + 'ignoring invalid wallet.json file ' + inner_path + '. wallet_str = ' + wallet_str + ', error = ' + e.message);
                                wallet = {}
                                extra.error = 'Invalid wallet.json. error = ' + e.message;
                            }
                        }
                        z_cache.wallet_json = wallet;
                        cb(z_cache.wallet_json, extra);
                        while (get_wallet_json_cbs.length) {
                            cb = get_wallet_json_cbs.shift();
                            cb(z_cache.wallet_json, extra)
                        }
                    }); // z_file_get callback 2
                }); // get_user_path callback 1
            } // get_wallet_json

            function write_wallet_json(cb) {
                var pgm = service + '.write_wallet_json: ';
                var inner_path, data, json_raw, debug_seq;
                data = z_cache.wallet_json || {};
                json_raw = unescape(encodeURIComponent(JSON.stringify(data, null, "\t")));
                get_user_path(function (user_path) {
                    var pgm = service + '.write_wallet_json get_user_path callback 1: ';
                    var inner_path, debug_seq ;
                    inner_path = user_path + 'wallet.json' ;
                    // console.log(pgm + 'calling fileWrite. path = ' + inner_path) ;
                    z_file_write(pgm, inner_path, btoa(json_raw), {}, function (res) {
                        var pgm = service + '.write_wallet_json fileWrite callback 2: ';
                        console.log(pgm + 'res = ' + JSON.stringify(res)) ;
                        if (res != 'ok') return cb(res) ;
                        cb(res);
                    }); // fileWrite callback 2
                }) ; // get_user_path callback 2
            } // write_wallet_json

            // write public wallet info
            function update_wallet_json(cb) {
                var pgm = service + '.update_wallet_json: ';
                if (!cb) cb = function () {};

                get_my_wallet_hub(function (hub, other_wallet_data_hub, other_wallet_data_hub_title) {
                    get_wallet_json(function (wallet, extra) {
                        var pgm = service + '.update_wallet_json get_wallet_json callback 2: ';
                        var old_wallet_str, old_wallet_json, error, key, wallet_sha256, w3_query_3, debug_seq2 ;
                        console.log(pgm + 'wallet = ' + JSON.stringify(wallet) + ', extra = ' + JSON.stringify(extra));
                        old_wallet_str = JSON.stringify(wallet) ;
                        old_wallet_json = JSON.parse(old_wallet_str) ;
                        if (JSON.stringify(wallet) != JSON.stringify({})) {
                            // validate after read
                            error = MoneyNetworkAPILib.validate_json(pgm, wallet) ;
                            if (error) {
                                // old wallet info is invalid. delete all
                                console.log(pgm + 'deleting invalid wallet.json. error = ' + error) ;
                                for (key in wallet) delete wallet[key]
                            }
                        }
                        wallet.msgtype = 'wallet' ;
                        wallet.wallet_address = ZeroFrame.site_info.address;
                        wallet.wallet_domain = ZeroFrame.site_info.domain;
                        if (!wallet.wallet_domain) delete wallet.wallet_domain ;
                        wallet.wallet_title = ZeroFrame.site_info.content.title;
                        wallet.wallet_description = ZeroFrame.site_info.content.description;
                        wallet.currencies = [{
                            code: 'tETH',
                            name: 'Test ether',
                            url: 'http://faucet.ropsten.be:3001/',
                            fee_info: 'See https://ethgasstation.info/',
                            units: [
                                { unit: 'ether', factor: 1, decimals: 18 },
                                { unit: 'milliether', factor: 1e-3, decimals: 15 },
                                { unit: 'microether', factor: 1e-6, decimals: 12 },
                                { unit: 'Gwei', factor: 1e-9, decimals: 9 },
                                { unit: 'Mwei', factor: 1e-12, decimals: 6 },
                                { unit: 'Kwei', factor: 1e-15, decimals: 3 },
                                { unit: 'wei', factor: 1e-18, decimals: 0 }
                            ]
                        }];
                        wallet.api_url = 'https://docs.ethers.io/ethers.js' ;
                        // random wallet data hub. for list of wallet hubs
                        if (!wallet.hub) {
                            wallet.hub = other_wallet_data_hub ;
                            if (other_wallet_data_hub_title) wallet.hub_title = other_wallet_data_hub_title ;
                            else delete wallet.hub_title ;
                        }
                        // extra info for cross wallet site integration. identical currencies, schemas and workflow. maybe compatible
                        wallet.json_schemas = extra_json_schemas ;
                        wallet.message_workflow = message_workflow ;

                        // calc wallet_sha256 signature. sha256 signature can be used instead of wallet_address, wallet_title, wallet_description and wallet_currencies
                        wallet_sha256 = MoneyNetworkAPILib.calc_wallet_sha256 (wallet) ;
                        if (!wallet_sha256) {
                            console.log(pgm + 'cannot calculate wallet_sha256. See error in log. wallet = ' + JSON.stringify(wallet)) ;
                            return cb('cannot calculate wallet_sha256. See error in log. wallet = ' + JSON.stringify(wallet));
                        }
                        console.log(pgm + 'wallet_sha256 = ' + wallet_sha256) ;
                        if ((wallet.msgtype == old_wallet_json.msgtype) &&
                            (wallet_sha256 == old_wallet_json.wallet_sha256) &&
                            (wallet.hub == old_wallet_json.hub)) {
                            console.log(pgm + 'ok. no change to public wallet information') ;
                            return cb("ok") ;
                        }
                        else {
                            console.log(pgm + 'updating wallet.json') ;
                            if (wallet.msgtype != old_wallet_json.msgtype) console.log(pgm + 'changed msgtype. old = ' + old_wallet_json.msgtype + ', new = ' + wallet.msgtype) ;
                            if (wallet_sha256 != old_wallet_json.wallet_sha256) console.log(pgm + 'changed wallet_sha256. old = ' + old_wallet_json.wallet_sha256 + ', new = ' + wallet_sha256) ;
                            if (wallet.hub != old_wallet_json.hub) console.log(pgm + 'changed hub. old = ' + old_wallet_json.hub + ', new = ' + wallet.hub) ;
                        }

                        // count number of wallets with this wallet_sha256 signature
                        // there should always be 5 wallets with identical full wallet information (wallet_address, wallet_title, wallet_description, currencies and wallet_sha256)
                        wallet.wallet_sha256 = wallet_sha256 ;
                        w3_query_3 =
                            "select count(*) as no from (" +
                            "  select keyvalue.json_id, count(*) as no " +
                            "  from keyvalue as wallet_sha256, json, keyvalue " +
                            "  where wallet_sha256.key = 'wallet_sha256' " +
                            "  and wallet_sha256.value = '" + wallet_sha256 + "' " +
                            "  and json.json_id = wallet_sha256.json_id " +
                            "  and json.directory like '" + hub + "/%' " +
                            "  and keyvalue.json_id = wallet_sha256.json_id " +
                            "  and keyvalue.value is not null " +
                            "  and keyvalue.key like 'wallet_%' " +
                            "  group by keyvalue.json_id " +
                            "  having count(*) >= 4" +
                            ")" ;
                        console.log(pgm + 'w3 query 3 = ' + w3_query_3) ;
                        debug_seq2 = MoneyNetworkAPILib.debug_z_api_operation_start(pgm, 'w3 query 3', 'dbQuery') ;
                        ZeroFrame.cmd("dbQuery", [w3_query_3], function (res) {
                            var pgm = service + '.update_wallet_json dbQuery callback 3: ';
                            var write_full_info ;
                            MoneyNetworkAPILib.debug_z_api_operation_end(debug_seq2, (!res || res.error) ? 'Failed. error = ' + JSON.stringify(res) : 'OK. Returned ' + res.length + ' rows');
                            // console.log(pgm + 'res = ' + JSON.stringify(res)) ;
                            if (res.error || (res.length != 1)) {
                                console.log(pgm + 'wallet sha256 query failed. res = ' + JSON.stringify(res));
                                console.log(pgm + 'w3 query 3 = ' + w3_query_3);
                                write_full_info = true;
                            }
                            else write_full_info = (res[0].no < 5) ;
                            console.log(pgm + 'write_full_info = ' + write_full_info) ;
                            if (!write_full_info) {
                                // full wallet info is already in database. only wallet_sha256 signature is needed in wallet.json
                                delete wallet.wallet_address ;
                                delete wallet.wallet_domain ;
                                delete wallet.wallet_title ;
                                delete wallet.wallet_description ;
                                delete wallet.currencies ;
                                delete wallet.api_url ;
                                delete wallet.json_schemas ;
                                delete wallet.message_workflow ;
                            }
                            if (old_wallet_str == JSON.stringify(wallet)) return cb('ok'); // no change to public wallet information
                            console.log(pgm + 'wallet = ' + JSON.stringify(wallet));
                            // validate before write. also done in calc_wallet_sha256
                            error = MoneyNetworkAPILib.validate_json(pgm, wallet) ;
                            if (error) return cb('cannot write invalid wallet.json. error = ' + error + ', wallet = ' + JSON.stringify(wallet));
                            if (wallet.user_seq || wallet.wallet_modified || wallet.wallet_directory) return cb('cannot write invalid wallet.json. user_seq, wallet_modified and wallet_directory fields are only used by MN in wallets.json files');
                            write_wallet_json(function (res) {
                                var pgm = service + '.update_wallet_json write_wallet_json callback 4: ';
                                console.log(pgm + 'res = ' + JSON.stringify(res));
                                if (res == "ok") {
                                    console.log(pgm + 'sign now and publish after end of session handshake. see initialize');
                                    z_publish({publish: false, reason: 'wallet.json'}, cb);
                                }
                                else cb(res);
                            }); // write_wallet_json callback 4
                        }) ; // dbQuery callback 3
                    }); // get_wallet_json callback 2
                }) ; // get_my_wallet_hub callback 1
            } // update_wallet_json

            function save_w_session(session_info, options, cb) {
                var pgm = service + '.save_w_session: ' ;
                var pgm2, group_debug_seq, auth_address, sha256 ;
                if (status.restoring) return ; // restoring backup
                sessionid = session_info.money_transactionid ;
                if (!options) options = {} ;
                if (!cb) cb = function() {} ;
                group_debug_seq = options.group_debug_seq ;
                pgm2 = MoneyNetworkAPILib.get_group_debug_seq_pgm(pgm, group_debug_seq) ;
                console.log(pgm2 + 'save new wallet to wallet session encrypted in ls. session_info = ' + JSON.stringify(session_info));
                if (!ls.w_sessions) ls.w_sessions = {};
                auth_address = ZeroFrame.site_info.auth_address;
                if (!ls.w_sessions[auth_address]) ls.w_sessions[auth_address] = {};
                // cache unencrypted session info in z_cache
                if (!z_cache.w_sessions) z_cache.w_sessions = {} ;
                if (!z_cache.w_sessions[auth_address]) z_cache.w_sessions[auth_address] = {};
                sha256 = CryptoJS.SHA256(sessionid).toString();
                if (z_cache.w_sessions[auth_address][sha256]) {
                    console.log(pgm + 'session_info is already in z_cache') ;
                    if (JSON.stringify(session_info) != JSON.stringify(z_cache.w_sessions[auth_address][sha256])) {
                        console.log(pgm + 'error. difference between session_info in save_w_session call and session_info in z_cache') ;
                        console.log(pgm + 'session_info = ' + JSON.stringify(session_info)) ;
                        console.log(pgm + 'z_cache session_info = ' + JSON.stringify(z_cache.w_sessions[auth_address][sha256])) ;
                        z_cache.w_sessions[auth_address][sha256] = session_info ;
                    }
                }
                else z_cache.w_sessions[auth_address][sha256] = session_info ;
                // encrypt and save encrypted in ls
                get_my_pubkey2(function (pubkey2) {
                    encrypt1.encrypt_json(session_info, {encryptions: [2], group_debug_seq: group_debug_seq}, function (encrypted_session_info) {
                        ls.w_sessions[auth_address][sha256] = encrypted_session_info;
                        ls_save();
                        console.log(pgm + 'OK. Saved wallet-wallet session information in localStorage');
                        cb();
                    }); // encrypt_json
                }); // get_my_pubkey2
            } // save_w_session

            // read from z_cache (unencrypted) or load from ls (encrypted)
            // options:
            // - group_debug_seq: for console.log debug messages
            // - ip_external: boolean: refresh session_info.ip_external after session read?
            function read_w_session (sessionid, options, cb) {
                var pgm = service + '.read_w_session: ' ;
                var pgm2, group_debug_seq, ip_external, delete_msg, auth_address, sha256, encrypted_session_info, cb2 ;
                // get options
                if (!options) options = {} ;
                group_debug_seq = options.group_debug_seq ;
                pgm2 = MoneyNetworkAPILib.get_group_debug_seq_pgm(pgm, group_debug_seq) ;
                ip_external = options.ip_external ;
                if (typeof delete_msg == 'string') delete_msg = [delete_msg] ;

                // extend cb: optional refresh ip_external info
                cb2 = function (session_info) {
                    var debug_seq ;
                    if (!session_info) return cb(session_info) ;
                    if (!ip_external) return cb(session_info) ;
                    debug_seq = MoneyNetworkAPILib.debug_z_api_operation_start(pgm, null, 'serverInfo', null, group_debug_seq);
                    ZeroFrame.cmd("serverInfo", {}, function (server_info) {
                        MoneyNetworkAPILib.debug_z_api_operation_end(debug_seq, server_info ? 'OK' : 'Error');
                        session_info.ip_external = server_info.ip_external;
                        cb(session_info);
                    });
                } ; // cb2

                // check z_cache (already decrypted)
                if (!z_cache.w_sessions) z_cache.w_sessions = {};
                auth_address = ZeroFrame.site_info.auth_address;
                if (!z_cache.w_sessions[auth_address]) z_cache.w_sessions[auth_address] = {};
                sha256 = CryptoJS.SHA256(sessionid).toString();
                if (z_cache.w_sessions[auth_address][sha256]) {
                    // unencrypted session info is already in z_cache
                    return cb2(z_cache.w_sessions[auth_address][sha256]) ;
                }
                // load from ls (encrypted)
                if (!ls.w_sessions) ls.w_sessions = {};
                if (!ls.w_sessions[auth_address]) ls.w_sessions[auth_address] = {};
                encrypted_session_info = ls.w_sessions[auth_address][sha256];
                if (!encrypted_session_info) return cb2(); // not found in ls

                // decrypt session information
                get_my_pubkey2(function (pubkey2) {
                    var pgm = service + '.read_w_session get_my_pubkey2 callback 1: ' ;
                    encrypt1.decrypt_json(encrypted_session_info, {group_debug_seq: group_debug_seq}, function (session_info) {
                        var pgm = service + '.read_w_session decrypt_json callback 2: ' ;
                        var pgm2 ;
                        pgm2 = MoneyNetworkAPILib.get_group_debug_seq_pgm(pgm, group_debug_seq) ;
                        console.log(pgm2 + 'session_info = ' + JSON.stringify(session_info));
                        z_cache.w_sessions[auth_address][sha256] = session_info ;
                        cb2(session_info) ;
                    });
                }) ;

            } // read_w_session


            // after load old wallet sessions. cleanup offline and normal files that is not in session_info.files objects ( = ls.w_files )
            // for example waiting_for_file requests and status_mt messages
            function cleanup_offline_session_files () {
                var pgm = service + '.cleanup_offline_session_files: ';
                var session_files, filename, directory, w3_query_7, debug_seq, auth_address, sha256, session_info, ls_updated ;
                if (status.restoring) {
                    // stop. restore process is running
                    console.log(pgm + 'stop. restore operation is running') ;
                    return ;
                }
                if (!ls.w_files) ls.w_files = {} ;
                // migration. any files in session_info.files that is not in w_files
                // session_info is encrypted with user cert. ls.w_files is not encrypted and for all certs
                if (!z_cache.w_sessions) z_cache.w_sessions = {} ;
                auth_address = ZeroFrame.site_info.auth_address ;
                if (!z_cache.w_sessions[auth_address]) z_cache.w_sessions[auth_address] = {} ;
                for (sha256 in z_cache.w_sessions[auth_address]) {
                    session_info = z_cache.w_sessions[auth_address][sha256] ;
                    if (!session_info.files) continue ;
                    for (filename in session_info.files) {
                        if (!ls.w_files[filename]) {
                            ls.w_files[filename] = true ;
                            ls_updated = true ;
                        }
                    }
                }
                // initialize session_files
                session_files = [] ;
                for (filename in ls.w_files) session_files.push(filename) ;
                console.log(pgm + 'session_files = ' + JSON.stringify(session_files)) ;
                //session_files = [
                //    "a932f57dcd-o.1512390150104","a932f57dcd-o.1512390209794","74aff4c388-o.1512410824922",
                //    "e17de9be9e-o.1512464275445","572bba988f-o.1512466704466"] ;

                // get all files for current user directory (optional and normal)
                directory = z_cache.my_wallet_data_hub + "/data/users/" + ZeroFrame.site_info.auth_address ;
                w3_query_7 =
                    "select files_optional.filename from json, files_optional " +
                    "where json.directory like '" + directory + "' " +
                    "and json.file_name = 'content.json' " +
                    "and files_optional.json_id = json.json_id " +
                    "  union all " +
                    "select files.filename from json, files " +
                    "where json.directory like '" + directory + "' " +
                    "and json.file_name = 'content.json' " +
                    "and files.json_id = json.json_id" ;
                console.log(pgm + 'w3_query_7 = ' + w3_query_7);
                debug_seq = MoneyNetworkAPILib.debug_z_api_operation_start(pgm, 'w3_query_7', 'dbQuery') ;
                ZeroFrame.cmd("dbQuery", [w3_query_7], function (db_files) {
                    var pgm = service + '.cleanup_offline_session_files dbQuery callback 1: ';
                    var i, re, m, delete_files ;
                    MoneyNetworkAPILib.debug_z_api_operation_end(debug_seq, (!db_files || db_files.error) ? 'Failed. error = ' + JSON.stringify(res) : 'OK. Returned ' + db_files.length + ' rows');
                    if (db_files.error) {
                        console.log(pgm + 'query failed. error = ' + db_files.error);
                        console.log(pgm + 'w3_query_7 = ' + w3_query_7);
                        return;
                    }
                    // keeping only normal and -o offline files in cleanup loop
                    re = new RegExp('^[0-9a-f]{10}(-o|-io)?\.[0-9]{13}$');
                    for (i = db_files.length - 1; i >= 0; i--) {
                        m = db_files[i].filename.match(re);
                        if (!m) db_files.splice(i, 1);
                        else db_files[i] = db_files[i].filename ;
                    }
                    console.log(pgm + 'db_files = ' + JSON.stringify(db_files));

                    delete_files = [] ;
                    for (i=0 ; i<db_files.length ; i++) {
                        filename = db_files[i] ;
                        if (session_files.indexOf(filename) == -1) delete_files.push(filename) ;
                    }
                    console.log(pgm + 'delete_files = ' + JSON.stringify(delete_files)) ;
                    if (!delete_files.length) {
                        if (z_publish_pending) {
                            console.log(pgm + 'pending publish. wallet.json updated? temporary session files deleted? publish to distribute changes to other users');
                            z_publish({publish: true, reason: 'cleanup_offline_session_files. pending publish'}, function (res) {
                                if (ls_updated) ls_save() ;
                            });
                        }
                        return ;
                    }

                    MoneyNetworkAPILib.start_transaction(pgm, function (transaction_timestamp) {
                        var pgm = service + '.cleanup_offline_session_files start_transaction callback 2: ';
                        var merged_directory, no_deleted, no_not_deleted, delete_file ;
                        // delete delete_file callback loop
                        merged_directory = 'merged-' + MoneyNetworkAPILib.get_merged_type() + '/' + directory + '/' ;
                        no_deleted = 0 ;
                        no_not_deleted = 0 ;
                        delete_file = function() {
                            var pgm = service + '.cleanup_offline_session_files.delete_file: ';
                            var filename, inner_path ;
                            filename = delete_files.shift() ;
                            if (status.restoring) {
                                // stop. restore process is running
                                console.log(pgm + 'stop. restore operation is running') ;
                                return ;
                            }
                            if (!filename) {
                                MoneyNetworkAPILib.end_transaction(transaction_timestamp) ;
                                if (no_deleted) console.log(pgm + no_deleted + ' files were deleted.') ;
                                if (no_not_deleted) console.log(pgm + no_not_deleted + ' files were not deleted. See error message above') ;
                                if (no_deleted) {
                                    z_publish({publish: true, reason: 'load_w_sessions/cleanup_offline_session_files. ' + no_deleted + ' file(s) deleted'}, function(res) {
                                        if (ls_updated) ls_save() ;
                                    }) ;
                                }
                                else if (z_publish_pending) {
                                    console.log(pgm + 'pending publish. wallet.json updated? temporary session files deleted? publish to distribute changes to other users');
                                    z_publish({publish: true, reason: 'cleanup_offline_session_files. pending publish'}, function (res) {
                                        if (ls_updated) ls_save() ;
                                    });
                                }
                                return ;
                            }
                            inner_path = merged_directory + filename ;
                            MoneyNetworkAPILib.z_file_delete(pgm, inner_path, function (res) {
                                if (res =='ok') no_deleted++ ;
                                else {
                                    console.log(pgm + 'error. ' + filename + ' was not deleted. res = ' + JSON.stringify(res)) ;
                                    no_not_deleted++ ;
                                }
                                // delete next file
                                delete_file() ;
                            }) ;
                        } ; // delete_file
                        // start delete_file loop
                        delete_file() ;
                    }) ; // start_transaction callback 2

                }); // dbQuery callback

            } // cleanup_offline_session_files


            // start up. load wallet session from ls and initialize MoneyNetworkAPI objects. One for each wallet session
            function load_w_sessions() {
                var pgm = service + '.load_w_sessions: ';
                var auth_address, sha256_values, group_debug_seq, no_loaded, no_not_loaded ;
                if (!ls.w_sessions) {
                    // no wallet sessions were found in ls
                    console.log(pgm + 'stop. no wallet session were found in ls') ;
                    return;
                }
                if (!ZeroFrame.site_info.cert_user_id) {
                    // not logged in
                    console.log(pgm + 'stop. not logged in') ;
                    return ;
                }
                if (status.restoring) {
                    // stop. restore process is running
                    console.log(pgm + 'stop. restore operation is running') ;
                    return ;

                }
                auth_address = ZeroFrame.site_info.auth_address;
                if (!ls.w_sessions[auth_address]) return; // no wallet sessions was found for this auth_address
                sha256_values = Object.keys(ls.w_sessions[auth_address]);
                if (!z_cache.w_sessions) z_cache.w_sessions = {} ;
                if (!z_cache.w_sessions[auth_address]) z_cache.w_sessions[auth_address] = {} ;
                group_debug_seq = MoneyNetworkAPILib.debug_group_operation_start() ;
                console.log(pgm + 'Using group_debug_seq ' + group_debug_seq + ' for this load_w_sessions operation');
                no_loaded = 0 ;
                no_not_loaded = 0 ;

                // initialize self encryption object encrypt1
                get_my_pubkey2(function (pubkey2) {
                    var pgm = service + '.load_w_sessions get_my_pubkey2 callback: ';
                    var load_session ;

                    // create load session loop. decrypt and initialize wallet sessions one by one
                    load_session = function () {
                        var pgm = service + '.load_w_sessions.load_session: ';
                        var pgm2, sha256, encrypted_session_info;
                        pgm2 = MoneyNetworkAPILib.get_group_debug_seq_pgm(pgm, group_debug_seq);
                        sha256 = sha256_values.shift();
                        if (status.restoring) {
                            // stop. restore process is running
                            console.log(pgm + 'stop. restore operation is running') ;
                            return ;
                        }
                        if (!sha256) {
                            MoneyNetworkAPILib.debug_group_operation_end(group_debug_seq) ;
                            console.log(pgm2 + 'done loading old wallet sessions. ' + no_loaded + ' wallet sessions were loaded. ' + no_not_loaded + ' wallet sessions were not loaded') ;
                            cleanup_offline_session_files() ;
                            return;
                        }
                        encrypted_session_info = ls.w_sessions[auth_address][sha256];
                        console.log(pgm2 + 'encrypted_session_info = ' + JSON.stringify(encrypted_session_info)) ;
                        // decrypt session information
                        encrypt1.decrypt_json(encrypted_session_info, {group_debug_seq: group_debug_seq}, function (session_info) {
                            var pgm = service + '.read_w_session decrypt_json callback 2: ';
                            var pgm2;
                            pgm2 = MoneyNetworkAPILib.get_group_debug_seq_pgm(pgm, group_debug_seq);
                            console.log(pgm2 + 'session_info = ' + JSON.stringify(session_info));
                            if (!session_info) {
                                console.log(pgm2 + 'decrypt_json failed for encrypted_session_info = ' + JSON.stringify(encrypted_session_info)) ;
                                // load next wallet session
                                no_not_loaded++ ;
                                return load_session() ;
                            }
                            if (session_info.money_transactionid == 'WEWMZyr6JaTc1JpOu5pI7A4Btjk7oXiqGlaDXtjMN2J2rDofMijpazqP2eEg') delete session_info.error ;
                            if (session_info.error) {
                                console.log(pgm2 + 'ignoring old failed wallet session. error = ' + session_info.error + ', session_info = ' + JSON.stringify(session_info)) ;
                                // load next wallet session
                                no_not_loaded++ ;
                                return load_session() ;
                            }
                            // https://github.com/jaros1/Money-Network/issues/273
                            // renamed master to sender (and client to receiver)
                            if (session_info.hasOwnProperty('master')) {
                                session_info.sender = session_info.master ;
                                delete session_info.master ;
                            }
                            if (typeof session_info.sender != 'boolean') console.log(pgm + 'error. sender is invalid. session_info = ' + JSON.stringify(session_info));
                            z_cache.w_sessions[auth_address][sha256] = session_info;
                            // initialize MoneyNetworkAPI instance for this wallet session
                            new MoneyNetworkAPI({
                                debug: session_info.sender ? 'encrypt3' : 'encrypt4',
                                sessionid: session_info.money_transactionid,
                                sender: session_info.sender,
                                prvkey: session_info.prvkey,
                                userid2: session_info.userid2,
                                pubkey: session_info.pubkey,
                                pubkey2: session_info.pubkey2
                            });
                            no_loaded++ ;
                            // load next wallet session
                            load_session() ;
                        });

                    }; // load_session ;
                    // start load sessions loop
                    load_session();

                }); // get_my_pubkey2 callback

            } // load_w_sessions
            // run when ZeroNet and Ls is ready
            // ls_bind(load_w_sessions) ;


            // show error in log, notification in w3 and error notification in mn
            // - pgm: calling pgm
            // - error: string or array of strings
            // - options. object with log, w3 and mn booleans. default is true
            function report_error (pgm, error, options, cb) {
                var request, notification ;
                // validate parameters.
                if ((typeof pgm != 'string') ||
                    ((typeof error != 'string') && !Array.isArray(error)) ||
                    (options && (typeof options != 'object')) &&
                    (cb && typeof cb != 'function')) {
                    console.log(service + '.report_error: invalid call. p1 pgm = ', pgm + ', p2 error = ', error, ', p3 options = ', options, ', p4 cb = ', cb) ;
                    return ;
                }
                if (typeof error == 'string') error = [error] ;
                if (!options) options = {} ;
                else options = JSON.parse(JSON.stringify(options)) ;
                if (!options.hasOwnProperty('log')) options.log = true ;
                if (!options.hasOwnProperty('w3')) options.w3 = true ;
                if (!options.hasOwnProperty('mn')) options.mn = true ;
                if (!options.hasOwnProperty('type')) options.type = 'error' ;
                if (['info', 'error', 'done'].indexOf(options.type) == -1) {
                    console.log(pgm + 'warning. invalid options.type ', options.type + '. using error type') ;
                    options.type = 'error' ;
                }
                if (options.group_debug_seq && !options.hasOwnProperty('end_group_operation')) options.end_group_operation = true ;
                if (options.log) console.log(pgm + error.join('. ')) ;
                if (options.w3) {
                    notification = [options.type, error.join('<br>')] ;
                    if (options.timeout) notification.push(options.timeout) ;
                    z_wrapper_notification(notification);
                }
                if (!options.mn) {
                    if (options.end_group_operation) MoneyNetworkAPILib.debug_group_operation_end(options.group_debug_seq, pgm + error.join('. ')) ;
                    return ;
                }
                if (!cb) cb = function() {} ;
                if (!encrypt2.sessionid) {
                    console.log(pgm + 'No MN-W3 session. Skipping MN notification') ;
                    if (options.end_group_operation) MoneyNetworkAPILib.debug_group_operation_end(options.group_debug_seq, pgm + error.join('. ')) ;
                    return ;
                }
                // send error notification to mn session using global encrypt2 object (mn-w3 session)
                request = {
                    msgtype: 'notification',
                    type: options.type,
                    message: error.join('<br>')
                };
                if (options.timeout) request.timeout = options.timeout ;
                console.log(pgm + 'request = ' + JSON.stringify(request));
                encrypt2.send_message(request, {response: false, group_debug_seq: options.group_debug_seq, end_group_operation: options.end_group_operation}, function (response) {
                    console.log(pgm + 'response = ' + JSON.stringify(response)) ;
                    // if (options.end_group_operation) MoneyNetworkAPILib.debug_group_operation_end(options.group_debug_seq, pgm + error.join('. ')) ;
                    cb() ;
                }); // send_message callback
            } // report error

            // before sending money transaction files. check if zeronet port is open. required for optional files distribution (money transactions)
            // server_info about port maybe old and not always true when enabling/disabling vpn on a client
            // serverPortcheck request can be used to refresh port info but requires ADMIN permission
            function check_port (pgm, session_info, group_debug_seq, send_exception, cb) {
                var debug_seq;
                debug_seq = MoneyNetworkAPILib.debug_z_api_operation_start(pgm, null, 'serverInfo', null, group_debug_seq);
                ZeroFrame.cmd("serverInfo", {}, function (server_info) {
                    try {
                        MoneyNetworkAPILib.debug_z_api_operation_end(debug_seq, server_info ? 'OK' : 'Error');
                        session_info.ip_external = server_info.ip_external;
                        if (!session_info.ip_external) console.log(pgm + 'ZeroNet port should be closed. Re-check port! Using normal files instead of optional files for money transactions. Distributed to all users');
                        else console.log(pgm + 'ZeroNet port should be open. Re-check port! Using optional files for money transactions. Distributed by request.');
                        cb();
                    }
                    catch (e) { return send_exception(pgm, e) }
                });
            } // check_port


            // workaround used in receive w3_check_mt and w3_start_mt messages
            // receiving incoming messages in wrong order. pubkeys message is required
            // pubkeys message should be in optional_files table for same session with a lower timestamp
            // pubkeys message should be in ZeroNet optionalFileList with a status
            // demon should be asked to reprocess lost incoming pubkeys file
            // demon should be asked to reprocess this incoming <<in_msg_name>> message after pubkeys message
            // max no tries? there could be a JS error in receiving pubkeys message and process should not loop forever
            // 1: find filename for previous incoming file (or first) for this wallet session. should be pubkeys message
            // 2: add a pubkeys retry count to session_info and save. max <n> pubkeys retries
            // 3: ask message_demon to reprocess missing pubkeys file
            // 4: ask message_demon to reprocess this messsage again in a few seconds
            function wait_for_pubkeys_message (options) {
                var pgm = service + '.wait_for_pubkeys_message: ';
                var encrypt2, session_info, in_filename, in_msg_name, out_msg_name, group_debug_seq, w3_query_6, debug_seq1, file_timestamp ;

                // get parameters
                encrypt2 = options.encrypt2 ;
                session_info = options.session_info ;
                in_filename = options.in_filename ;
                in_msg_name = options.in_msg_name ;
                out_msg_name = options.out_msg_name ;
                group_debug_seq = options.group_debug_seq ;
                file_timestamp = parseInt(in_filename.substr(-13)) ;
                console.log(pgm + 'in_filename = ' + in_filename + ', file_timestamp = ' + file_timestamp) ;

                // 1: find filename for previous incoming file (=first) for this wallet session. should be pubkeys message
                w3_query_6 =
                    "select filename from files where filename like '" + encrypt2.other_session_filename + "%'" +
                    "  union all " +
                    "select filename from files_optional where filename like '" + encrypt2.other_session_filename + "%'" ;
                console.log(pgm + 'w3_query_6 = ' + w3_query_6) ;
                debug_seq1 = MoneyNetworkAPILib.debug_z_api_operation_start(pgm, 'w3 query 6', 'dbQuery', null, group_debug_seq) ;
                ZeroFrame.cmd("dbQuery", [w3_query_6], function (res) {
                    var pgm = service + '.wait_for_pubkeys_message dbQuery callback 1/' + group_debug_seq + ': ';
                    var re, i, timestamp, pubkeys_file_timestamp, pubkeys_filename, inner_path2, debug_seq2, redo_pubkeys, redo_this_msg, error ;
                    MoneyNetworkAPILib.debug_z_api_operation_end(debug_seq1, (!res || res.error) ? 'Failed. error = ' + JSON.stringify(res) : 'OK. Returned ' + res.length + ' rows');
                    console.log(pgm + 'res = ' + JSON.stringify(res)) ;
                    if (!res || res.error) {
                        console.log(pgm + 'error. search for pubkeys message failed. dbQuery failed. error = ' + JSON.stringify(res) ) ;
                        console.log(pgm + 'w3_query_6 = ' + w3_query_6) ;
                        MoneyNetworkAPILib.debug_group_operation_end(group_debug_seq, 'dbQuery failed. ' + JSON.stringify(res)) ;
                        error = ['Money transaction failed', 'Missing pubkeys message', 'w3_query_6 failed', 'Cannot start encrypted communication'] ;
                        report_error(pgm, error, {group_debug_seq: group_debug_seq}) ;
                        return ;
                    }
                    console.log(pgm + 'res = ' + JSON.stringify(res)) ;
                    // check filename. pubkeys message from other wallet session is a normal or an -o (external) optional file
                    re = /^[0-9a-f]{10}(-o)?\.[0-9]{13}$/;
                    console.log(pgm + 'old res.length = ' + res.length);
                    for (i = res.length - 1; i >= 0; i--) {
                        if (!res[i].filename.match(re)) continue; // invalid filename
                        else if (res[i].filename == in_filename) continue ; // this message
                        // check timestamp.
                        timestamp = parseInt(res[i].filename.slice(-13)) ;
                        if (timestamp > file_timestamp) continue ; // later messages after this message
                        if (!pubkeys_file_timestamp || (timestamp > pubkeys_file_timestamp)) {
                            // OK. should be pubkeys message
                            pubkeys_file_timestamp = timestamp ;
                            pubkeys_filename = res[i].filename ;
                        }
                    }
                    if (!pubkeys_file_timestamp) {
                        console.log(pgm + 'could not find any pubkeys message before this ' + in_msg_name + ' message') ;
                        error = ['Money transaction failed', 'Missing pubkeys message', 'Cannot start encrypted communication'] ;
                        session_info.error = error.join('. ') ; // mark transaction as failed. do not restart transaction
                        report_error(pgm, error, {group_debug_seq: group_debug_seq}, function() {
                            save_w_session(session_info, {group_debug_seq: group_debug_seq}) ;
                        }) ;
                        return ;
                    }
                    console.log(pgm + 'pubkeys_filename = ' + pubkeys_filename) ;

                    // 2: check optional file info for this lost pubkeys message
                    inner_path2 = encrypt2.other_user_path + pubkeys_filename ;
                    debug_seq2 = MoneyNetworkAPILib.debug_z_api_operation_start(pgm, inner_path2, 'optionalFileInfo', null, group_debug_seq);
                    ZeroFrame.cmd("optionalFileInfo", [inner_path2], function (file_info) {
                        var pgm = service + '.wait_for_pubkeys_message optionalFileInfo callback 2/' + group_debug_seq + ': ';

                        MoneyNetworkAPILib.debug_z_api_operation_end(debug_seq2, file_info ? 'OK' : 'Failed');
                        console.log(pgm + 'file_info = ' + JSON.stringify(file_info)) ;

                        // 3: add a counter for this fallback operation. Try 3 times
                        if (!session_info.lost_pubkey_message_count) session_info.lost_pubkey_message_count = 0 ;
                        session_info.lost_pubkey_message_count++ ;
                        save_w_session(session_info, {group_debug_seq: group_debug_seq}, function () {
                            var pgm = service + '.wait_for_pubkeys_message save_w_session callback 3/' + group_debug_seq + ': ';
                            var error ;
                            if (session_info.lost_pubkey_message_count > 3) {
                                console.log(pgm + 'stopping. tried 3 times to read lost pubkeys message. cannot send ' + out_msg_name + ' message without public keys') ;
                                error = ['Money transaction failed', 'Missing pubkeys message', 'Cannot start encrypted communication'] ;
                                report_error(pgm, error, {group_debug_seq: group_debug_seq}) ;
                                return ;
                            }
                            console.log(pgm + 'retrying receive pubkeys and ' + in_msg_name + ' messages. lost_pubkey_message_count = ' + session_info.lost_pubkey_message_count) ;

                            // 4: submit redo jobs
                            redo_pubkeys = function () {
                                var pgm = service + '.wait_for_pubkeys_message.redo_pubkeys/' + group_debug_seq + ': ';
                                var error ;
                                console.log(pgm + 'running redo_pubkeys for ' + pubkeys_filename) ;
                                encrypt2.redo_file(pubkeys_filename, function (error) {
                                    if (error) console.log(pgm, 'redo pubkeys message failed: error = ' + error) ;
                                });
                            } ;
                            redo_this_msg = function () {
                                var pgm = service + '.wait_for_pubkeys_message.redo_w3_check_mt/' + group_debug_seq + ': ';
                                var error ;
                                console.log(pgm + 'running redo_this_msg for ' + in_filename) ;
                                encrypt2.redo_file(in_filename, function (error) {
                                    if (error) console.log(pgm, 'redo ' + in_msg_name + ' failed: error = ' + error) ;
                                });
                            } ;
                            setTimeout(redo_pubkeys, 0) ;
                            setTimeout(redo_this_msg, 10000) ;
                            MoneyNetworkAPILib.debug_group_operation_end(group_debug_seq, 'OK. Submitted redo_pubkeys and redo_this_msg jobs') ;

                        }) ; // save_w_session callback 3

                    }) ; // optionalFileInfo callback 2

                }) ; // dbQuery callback 1

            } // wait_for_pubkeys_message

            // cleanup old outgoing files, example:
            // - is "sender"
            // - is receiving w3_check_mt message from "receiver"
            // - "receiver" must have received 'pubkeys' message from "sender"
            // - find and delete pubkeys message from sender to receiver
            function delete_old_msg (options, cb) {
                var pgm = service + '.delete_old_msg: ';
                var session_info, msg_name, encrypt, group_debug_seq, msg_filename, key, inner_path, pgm2 ;
                // get params
                session_info = options.session_info ;
                msg_name = options.msg_name ;
                encrypt = options.encrypt ;
                group_debug_seq = options.group_debug_seq ;
                pgm2 = MoneyNetworkAPILib.get_group_debug_seq_pgm(pgm, group_debug_seq) ;
                // find file
                if (!session_info.files) session_info.files = {} ;
                msg_filename = null ;
                for (key in session_info.files) if (session_info.files[key].msgtype == msg_name) msg_filename = key ;
                if (!msg_filename) {
                    console.log(pgm2 + 'warning. no cleanup. ' + msg_name + ' was not found in session_info.files') ;
                    return cb() ;
                }
                console.log(pgm2 + 'delete old outgoing ' + msg_name + ' from user directory and from session_info.files') ;
                // delete file
                inner_path = encrypt.this_user_path + msg_filename ;
                MoneyNetworkAPILib.z_file_delete(pgm, inner_path, function (res) {
                    var pgm = service + '.delete_old_msg z_file_delete callback: ';
                    var pgm2, auth_address ;
                    pgm2 = MoneyNetworkAPILib.get_group_debug_seq_pgm(pgm, group_debug_seq) ;
                    console.log(pgm2 + 'res = ' + JSON.stringify(res)) ;
                    delete session_info.files[msg_filename] ;
                    if (!ls.w_files) ls.w_files = {} ;
                    delete ls.w_files[msg_filename] ;
                    cb() ;
                }) ; // z_file_delete
            } // delete_old_msg

            // end of money transaction processing. cleanup. delete:
            // - public and private keys
            function cleanup_session_info (session_info) {
                delete session_info.ip_external ;
                delete session_info.prvkey ;
                delete session_info.userid2 ;
                delete session_info.pubkey ;
                delete session_info.pubkey2 ;
            } // cleanup_session_info

            // temporary save money transactions in memory and wait for send_mt request. all validations OK and chat msg with money transactions has been sent
            var new_money_transactions = {} ; // money_transactionid => {timestamp: new Date().getTime(), request: request, response: response}

            var wei_factor = etherService.get_wei_factor() ;
            function bn_toFixed (bn, decimals, add_thousands_separator) {
                return etherService.bn_toFixed (bn, decimals, add_thousands_separator) ;
            }

            // listen for incoming messages from MN and other wallet sessions. called from MoneyNetworkAPILib.demon
            // params:
            // - inner_path: inner_path to new incoming message
            // - encrypt2: instance of MoneyNetworkAPI class created with new MoneyNetworkAPI request
            function process_incoming_message(inner_path, encrypt2, encrypted_json_str, request, extra) {
                var pos, response_timestamp, request_timestamp, request_timeout_at, error, response,
                    send_response, subsystem, file_timestamp, group_debug_seq, pgm, now, send_exception,
                    filename;
                pgm = service + '.process_incoming_message: ';

                try {
                    if (status.restoring) {
                        console.log(pgm + 'restoring wallet. ignoring incoming ' + inner_path + ' message') ;
                        return ;
                    }

                    // get a group debug seq. track all connected log messages. there can be many running processes
                    if (extra && extra.group_debug_seq) group_debug_seq = extra.group_debug_seq ;
                    else group_debug_seq = MoneyNetworkAPILib.debug_group_operation_start();
                    pgm = service + '.process_incoming_message/' + group_debug_seq + ': ';
                    console.log(pgm + 'Using group_debug_seq ' + group_debug_seq + ' for this ' + (request && request.msgtype ? 'receive ' + request.msgtype + ' message' : 'process_incoming_message') + ' operation');
                    if (request && request.msgtype) MoneyNetworkAPILib.debug_group_operation_update(group_debug_seq, {msgtype: request.msgtype});

                    if (encrypt2.destroyed) {
                        // MoneyNetworkAPI instance has been destroyed. Maybe deleted session?
                        console.log(pgm + 'ignoring incoming message ' + inner_path + '. session has been destroyed. reason = ' + encrypt2.destroyed);
                        return;
                    }
                    console.log(pgm + 'processing inner_path = ' + inner_path + (encrypt2.debug ? ' with ' + encrypt2.debug : ''));
                    console.log(pgm + 'now = ' + (new Date().getTime()) + ', extra = ' + JSON.stringify(extra)) ;

                    // get filename.
                    pos = inner_path.lastIndexOf('/') ;
                    filename = inner_path.substr(pos+1) ;
                    console.log(pgm + 'filename = ' + filename);

                    // get file timestamp. used in response. double link between request and response
                    pos = inner_path.lastIndexOf('.');
                    file_timestamp = parseInt(inner_path.substr(pos + 1));
                    console.log(pgm + 'file_timestamp = ' + file_timestamp);

                    if (!request) {
                        console.log(pgm + 'no request. fileGet or decrypt must have failed. extra = ' + JSON.stringify(extra)) ;
                        //extra = {
                        //    "optional_file": true,
                        //    "group_debug_seq": 437,
                        //    "file_info": {
                        //        "inner_path": "data/users/18DbeZgtVCcLghmtzvg4Uv8uRQAwR8wnDQ/cd3d368a3b-o.1511428404811",
                        //        "uploaded": 0,
                        //        "is_pinned": 0,
                        //        "time_accessed": 0,
                        //        "site_id": 6,
                        //        "is_downloaded": 0,
                        //        "file_id": 17962,
                        //        "peer": 1,
                        //        "time_added": 1511428985,
                        //        "hash_id": 20096,
                        //        "time_downloaded": 0,
                        //        "size": 548
                        //    },
                        //    "timeout": true,
                        //    "db_query_at": 1511428985117,
                        //    "modified": 1511428438,
                        //    "fileget": true,
                        //    "decrypt": true,
                        //    "send_overhead": 34000,
                        //    "receive_overhead": 0,
                        //    "total_overhead": 34000
                        //};
                        // failed fileGet for incoming money transaction file?
                        if (encrypt2.hasOwnProperty('sender') && extra && extra.file_info && !extra.file_info.is_downloaded) {
                            // optional file download failed in wallet to wallet communication
                            error = ['Hanging money transaction', 'Timeout while waiting for ' + filename, 'Check ZeroPort/VPN status', 'Maybe restart ui-server', 'Maybe reload wallet page'] ;
                            // report_error(pgm, error, {group_debug_seq: group_debug_seq, type: 'info'}) ;
                            console.log(pgm + 'Warning. ' + error.join('. ')) ;
                        }
                        return ;
                    }

                    // remove any response timestamp before validation (used in response filename)
                    response_timestamp = request.response;
                    delete request.response; // request received. must use response_timestamp in response filename
                    request_timestamp = request.request;
                    delete request.request; // response received. todo: must be a response to previous send request with request timestamp in request filename
                    request_timeout_at = request.timeout_at;
                    delete request.timeout_at; // request received. when does request expire. how long does other session wait for response

                    // request timeout? check with and without "total_overhead"
                    now = new Date().getTime() ;
                    if (request_timeout_at < now) {
                        console.log(pgm + 'timeout. file_timestamp = ' + file_timestamp + ', request_timeout_at = ' + request_timeout_at + ', now = ' + now + ', total_overhead = ' + extra.total_overhead) ;
                        console.log(pgm + 'extra = ' + JSON.stringify(extra)) ;
                        if (request_timeout_at + extra.total_overhead < now) {
                            console.log(pgm + 'error. request timeout. ignoring request = ' + JSON.stringify(request) + ', inner_path = ' + inner_path);
                            MoneyNetworkAPILib.debug_group_operation_end(group_debug_seq, 'Timeout. Request is too old') ;
                            // sending timeout notification to other process
                            encrypt2.send_timeout_message(request.msgtype, 'W3: please resend ' + request.msgtype + ' request') ;
                            return;
                        }
                        else {
                            console.log(pgm + 'warning. request timeout. other session may reject response after timeout. processing request anyway');
                        }
                    }

                    console.log(pgm + 'request = ' + JSON.stringify(request));
                    response = {msgtype: 'response'};

                    // cb: post response callback. used in send_mt after sending OK response to MN
                    send_response = function (error, cb) {
                        if (!response_timestamp) {
                            // no response was requested
                            MoneyNetworkAPILib.debug_group_operation_end(group_debug_seq, error) ;
                            return;
                        }
                        if (error) response.error = error;
                        if (!cb) cb = function () {};
                        // send response to other session
                        encrypt2.send_message(response, {timestamp: response_timestamp, msgtype: request.msgtype, request: file_timestamp, timeout_at: request_timeout_at, group_debug_seq: group_debug_seq}, function (res) {
                            var pgm = service + '.process_incoming_message send_message callback 3/' + group_debug_seq + ': ';
                            console.log(pgm + 'res = ' + JSON.stringify(res));
                            //
                            cb();
                        }); // send_message callback 3

                    }; // send_response

                    // stack dump in w3 + send JS exception to MN
                    send_exception = function (pgm, e) {
                        var error ;
                        error = e.message || e || 'Unknown error';
                        console.log(pgm + error);
                        if (e.stack) console.log(pgm, e.stack);
                        return send_response(request.msgtype + ' request failed with JS error ' + error) ;
                    } ;

                    // validate and process incoming json message and process
                    if (request && (typeof request.msgtype == 'string') && (request.msgtype.substr(0, 3) == 'w3_')) subsystem = 'w3';
                    error = MoneyNetworkAPILib.validate_json(pgm, request, null, subsystem);
                    if (error) response.error = 'message is invalid. ' + error;
                    else if (request.msgtype == 'ping') {
                        // simple ping from MN. checking connection. return OK response
                    }
                    else if (request.msgtype == 'password') {
                        // got a password response from MN. Must be a lost get_password response.
                        console.log(pgm + 'error. got a password message. should only get a password message as a get_password response!');
                        response_timestamp = null;
                    }
                    else if (request.msgtype == 'get_balance') {
                        // get balance request from MN. Return error or balance in test Bitcoins
                        (function get_balance(){
                            try {
                                var pgm = service + '.process_incoming_message.' + request.msgtype + '/' + group_debug_seq + ': ';
                                if (!status.permissions || !status.permissions.get_balance) return send_response('get_balance operation is not authorized');
                                if (wallet_info.status != 'Open') {
                                    // wallet not open (not created, not logged in etc)
                                    if (!status.permissions.open_wallet) return send_response('open_wallet operation is not authorized');
                                    if (!request.open_wallet) return send_response('Wallet is not open and open_wallet was not requested');
                                    else if (etherService.is_login_info_missing(status)) return send_response('Wallet is not open and no wallet login was found');
                                    else if (request.close_wallet && !status.permissions.close_wallet) return send_response('close_wallet operation was requested but is not authorized');
                                    else {
                                        // open test ether wallet (also get_balance request)
                                        etherService.openWallet(status, function (error) {
                                            var wei_bn, ether_bn, ether_s ;
                                            try {
                                                if (error) {
                                                    // open wallet or get_balance request failed
                                                    if (wallet_info.status != 'Open') return send_response('Open wallet request failed with error = ' + error);
                                                    else {
                                                        response.error = 'Get balance request failed with error = ' + error;
                                                        // close wallet and send error
                                                        etherService.close_wallet(function (res) {
                                                            send_response();
                                                        });
                                                    }
                                                }
                                                // open wallet + get_balance request OK
                                                wei_bn = new BigNumber(wallet_info.confirmed_balance) ;
                                                ether_bn = wei_bn.dividedBy(wei_factor) ;
                                                ether_s = bn_toFixed(ether_bn, 18, false) ;
                                                response.msgtype = 'balance';
                                                response.balance = [{
                                                    code: 'tETH',
                                                    amount: ether_s
                                                }];
                                                response.balance_at = new Date().getTime();
                                                // close wallet and return balance info
                                                if (!request.close_wallet) send_response();
                                                else etherService.close_wallet(function (res) {
                                                    try { send_response() }
                                                    catch (e) { return send_exception(pgm, e) }
                                                });

                                            }
                                            catch (e) { return send_exception(pgm, e) }
                                        });
                                        return;
                                    }
                                }
                                else {
                                    // wallet already open. ignore open_wallet and close_wallet flags
                                    etherService.get_balance(function (error) {
                                        var wei_bn, ether_bn, ether_s ;
                                        try {
                                            if (error) return send_response('Get balance request failed with error = ' + error);
                                            // get_balance request OK
                                            wei_bn = new BigNumber(wallet_info.confirmed_balance) ;
                                            ether_bn = wei_bn.dividedBy(wei_factor) ;
                                            ether_s = bn_toFixed(ether_bn, 18, false) ;
                                            response.msgtype = 'balance';
                                            response.balance = [{code: 'tETH', amount: ether_s}];
                                            response.balance_at = new Date().getTime();
                                            send_response();
                                        }
                                        catch (e) { return send_exception(pgm, e) }
                                    });
                                    return;
                                }
                            }
                            catch (e) {return send_exception(pgm, e) }
                        })() ;
                        return ;
                        // end get_balance
                    }
                    else if (request.msgtype == 'prepare_mt_request') {
                        // step 1 in send money transaction(s) to contact
                        // got a prepare money transactions request from MN. Return error message or json to be included in chat message for each money transaction
                        (function prepare_mt_request() {
                            try {
                                var pgm = service + '.process_incoming_message.' + request.msgtype + '/' + group_debug_seq + ': ';
                                var send_money_bn, request_money_bn, i, money_transaction, jsons, step_2_confirm,
                                    step_1_open_wallet, step_3_check_balance, step_4_get_new_address,
                                    step_5_close_wallet, step_6_done_ok, amount2;

                                // check amount. must be a number (round to 18 decimals) or a string with 18 decimals
                                for (i = 0; i < request.money_transactions.length; i++) {
                                    money_transaction = request.money_transactions[i];
                                    if (typeof money_transaction.amount == 'number') money_transaction.amount.toFixed(8);
                                    else {
                                        // string. must be ether amount with 18 decimals
                                        amount2 = parseFloat(money_transaction.amount).toFixed(18) ;
                                        if (money_transaction.amount != amount2) return send_response('Expected amount in ether with 18 decimals. "' + money_transaction.amount + '" != "' + amount2 + '"') ;
                                    }
                                }

                                // check permissions
                                send_money_bn = null;
                                request_money_bn = null;
                                jsons = [];
                                for (i = 0; i < request.money_transactions.length; i++) {
                                    money_transaction = request.money_transactions[i];
                                    amount2 = new BigNumber(money_transaction.amount) ;
                                    if (money_transaction.action == 'Send') {
                                        if (!send_money_bn) send_money_bn = new BigNumber(0) ;
                                        send_money_bn = send_money_bn.plus(amount2) ;
                                    }
                                    if (money_transaction.action == 'Request') {
                                        if (!request_money_bn) request_money_bn = new BigNumber(0) ;
                                        request_money_bn = request_money_bn.plus(amount2) ;
                                    }
                                    jsons.push({});
                                }
                                console.log(pgm + 'send_money = ' + send_money_bn + ', request_money = ' + request_money_bn);
                                if (send_money_bn && (!status.permissions || !status.permissions.send_money)) return send_response('send_money operation is not authorized');
                                if (request_money_bn && (!status.permissions || !status.permissions.receive_money)) return send_response('receive_money operation is not authorized');

                                // 1) send money: check amount >= balance
                                // 2) general: balance - send amount + (request amount-fee) >= 0
                                // 3) refresh balance before validation
                                // 4) abort send but not yet effected money transactions? abort from wallet / abort from MN / abort from both contacts
                                // 5) create a session for direct wallet to wallet communication (publish is needed when communicating between wallets)
                                // 6) or use MN chat messages from communication?
                                // 7) always call get_address.
                                //    - send money: return address in case of aborted operation after send money request has been sent to external API
                                //    - request money: address for send money operation

                                // callback chain definitions
                                // prepare_mt_request. step 6.
                                step_6_done_ok = function () {
                                    var pgm = service + '.process_incoming_message.' + request.msgtype + '.step_6_done_ok/' + group_debug_seq + ': ';
                                    console.log(pgm + 'jsons = ' + JSON.stringify(jsons));

                                    // ready to send OK response with jsons to MN
                                    // jsons = [{"return_address":"2N23sTaKZT4SG1veLHrAxR1WLfNeqnBE4tT"}]
                                    response.msgtype = 'prepare_mt_response';
                                    response.jsons = jsons;
                                    // remember transactions and wait for send_mt request (chat msg has been sent)
                                    new_money_transactions[request.money_transactionid] = {
                                        timestamp: new Date().getTime(),
                                        request: request,
                                        response: response
                                    };
                                    console.log(pgm + 'new_money_transactions = ' + JSON.stringify(new_money_transactions));

                                    send_response();
                                }; // step_6_done_ok

                                // prepare_mt_request step 5: optional close wallet. only if wallet has been opened in step 2
                                step_5_close_wallet = function () {
                                    if (request.close_wallet) etherService.close_wallet(function (res) {
                                        step_6_done_ok()
                                    });
                                    else return step_6_done_ok();
                                }; // step_5_close_wallet

                                // prepare_mt_request step 4: get new ether address
                                // - send money - get return address to be used in case of a partly failed money transaction (multiple money transactions)
                                // - request money - address to be used in send money operation
                                step_4_get_new_address = function (i) {
                                    var pgm = service + '.process_incoming_message.' + request.msgtype + '.step_4_get_new_address/' + group_debug_seq + ': ';
                                    if (!i) i = 0;
                                    console.log(pgm + 'i = ' + i);
                                    if (i >= request.money_transactions.length) return step_5_close_wallet();
                                    etherService.get_address(function (error, address) {
                                        try {
                                            var money_transaction;
                                            if (error) {
                                                z_wrapper_notification(['error', 'Get ether address failed with<br>' + error]) ;
                                                return send_response('Could not get ether wallet address. error = ' + error);
                                            }
                                            money_transaction = request.money_transactions[i];
                                            if (money_transaction.action == 'Send') jsons[i].return_address = address;
                                            else jsons[i].address = address;
                                            step_4_get_new_address(i + 1);
                                        }
                                        catch (e) { return send_exception(pgm, e) }
                                    }); // get_new_address
                                }; // step_4_get_new_address

                                // prepare_mt_request step 3: optional check balance. Only for send money operations
                                step_3_check_balance = function () {
                                    var pgm = service + '.process_incoming_message.' + request.msgtype + '.step_3_check_balance/' + group_debug_seq + ': ';
                                    var wei_bn, wei_s ;
                                    if (!send_money_bn) return step_4_get_new_address();
                                    console.log(pgm + 'sending money. check wallet balance. send_money = ' + send_money_bn + ', balance: ', wallet_info.confirmed_balance + ', unconfirmed Balance: ', wallet_info.unconfirmed_balance);

                                    // estimate fee. using null as dummy address = address for my ether wallet
                                    try {
                                        wei_bn = send_money_bn.multipliedBy(wei_factor) ;
                                        wei_s = bn_toFixed(wei_bn, 0, false) ;

                                        etherService.estimate_fee(null, wei_s, function (fee, gas_estimate, gas_price) {
                                            var pgm, send_money_with_fee_bn, confirmed_balance_bn, unconfirmed_balance_bn;
                                            try {
                                                pgm = service + '.process_incoming_message.' + request.msgtype + '.step_3_check_balance estimate_fee callback 1/' + group_debug_seq + ': ';
                                                if (!fee) console.log(pgm + 'error. could not estimate gas fee');
                                                if (!fee) fee = 0;
                                                fee = new BigNumber(fee);
                                                send_money_with_fee_bn = send_money_bn.plus(fee);
                                                confirmed_balance_bn = new BigNumber(wallet_info.confirmed_balance);
                                                console.log(pgm + 'send_money_with_fee_bn = ' + send_money_with_fee_bn.toString(10) + ', confirmed_balance_bn = ' + confirmed_balance_bn.toString(10));
                                                if (confirmed_balance_bn.gte(send_money_with_fee_bn)) return step_4_get_new_address(); // OK
                                                unconfirmed_balance_bn = new BigNumber(wallet_info.unconfirmed_balance);
                                                console.log(pgm + 'send_money_with_fee_bn = ' + send_money_with_fee_bn.toString(10) + ', unconfirmed_balance_bn = ' + unconfirmed_balance_bn.toString(10));
                                                if (unconfirmed_balance_bn.lt(send_money_with_fee_bn)) send_response('insufficient balance for send money operation(s)');
                                                else send_response('insufficient balance confirmed balance for send money operation(s)');
                                            }
                                            catch (e) {
                                                console.log(pgm, 'exception', e);
                                                return send_exception(pgm, e)
                                            }
                                        }); // estimate_fee callback 1
                                    }
                                    catch (e) {
                                        console.log(pgm, 'exception', e);
                                        return send_exception(pgm, e)
                                    }
                                }; // step_3_check_balance

                                // prepare_mt_request step 2: sender - optional confirm money transaction (see permissions)
                                step_2_confirm = function () {
                                    var pgm = service + '.process_incoming_message.' + request.msgtype + '.step_2_confirm/' + group_debug_seq + ': ';
                                    var send_fee, optional_calc_send_fee, request_fee, optional_calc_request_fee;
                                    if (wallet_info.status != 'Open') {
                                        // wallet not open (not created, not logged in etc)
                                        if (!status.permissions.open_wallet) return send_response('Cannot send money transaction. Open wallet operation is not authorized');
                                        if (!request.open_wallet) return send_response('Cannot send money transaction. Wallet is not open and open_wallet was not requested');
                                        else if (etherService.is_login_info_missing(status)) return send_response('Cannot send money transaction. Wallet is not open and no wallet login was found');
                                    }
                                    if (request.close_wallet && !status.permissions.close_wallet) return send_response('Cannot send money transaction. Close wallet operation was requested but is not authorized');
                                    if (!status.permissions.confirm) return step_3_check_balance();

                                    // calculate fees
                                    optional_calc_send_fee = function (cb) {
                                        var wei_bn, wei_s ;
                                        if (!send_money_bn) return cb() ;
                                        wei_bn = send_money_bn.multipliedBy(wei_factor) ;
                                        wei_s = bn_toFixed(wei_bn, 0, false) ;
                                        etherService.estimate_fee(null, wei_s, function (fee, gas_estimate, gas_price) {
                                            send_fee = fee ;
                                            cb() ;
                                        }) ;
                                    } ; // optional_calc_send_fee
                                    optional_calc_request_fee = function (cb) {
                                        var wei_bn, wei_s ;
                                        if (!request_money_bn) return cb() ;
                                        wei_bn = request_money_bn.multipliedBy(wei_factor) ;
                                        wei_s = bn_toFixed(wei_bn, 0, false) ;
                                        etherService.estimate_fee(null, wei_s, function (fee, gas_estimate, gas_price) {
                                            request_fee = fee ;
                                            cb() ;
                                        }) ;
                                    } ; // optional_calc_request_fee

                                    optional_calc_send_fee(function() {
                                        var pgm = service + '.process_incoming_message.' + request.msgtype + '.step_2_confirm optional_calc_send_fee callback 1/' + group_debug_seq + ': ';
                                        optional_calc_request_fee(function() {
                                            var pgm = service + '.process_incoming_message.' + request.msgtype + '.step_2_confirm optional_calc_request_fee callback 2/' + group_debug_seq + ': ';

                                            var confirm_status, confirm_timeout_fnk, ether_bn, ether_s, wei_bn, wei_s, send_msg, request_msg, message, request2 ;

                                            // ready for confirm dialog
                                            // open two confirm dialog boxes.
                                            // one here in W3 session. The other in MN session
                                            // timeout in prepare_mt_request request from MN is 60 seconds.
                                            // timeout in confirm dialog box is 50 seconds
                                            confirm_status = {done: false};
                                            confirm_timeout_fnk = function () {
                                                if (confirm_status.done) return; // confirm dialog done
                                                confirm_status.done = true;
                                                send_response('Confirm transaction timeout')
                                            };
                                            setTimeout(confirm_timeout_fnk, 50000);

                                            // create confirm message with fee info
                                            message = [] ;
                                            if (send_money_bn) {
                                                ether_s = bn_toFixed(send_money_bn, 18, true) ;
                                                wei_bn = send_money_bn.multipliedBy(wei_factor) ;
                                                wei_s = bn_toFixed(wei_bn, 0, true) ;
                                                send_msg = 'Send ' + ether_s + ' tETH / '+ wei_s + ' test wei' + ' to ' + request.contact.alias + '?' ;
                                                // add fee info. paid by sender
                                                if (send_fee) {
                                                    wei_bn = new BigNumber(send_fee) ;
                                                    ether_bn = wei_bn.dividedBy(wei_factor) ;
                                                    ether_s = bn_toFixed(ether_bn, 18, true) ;
                                                    wei_s = bn_toFixed(wei_bn, 0, true) ;
                                                    send_msg += '<br>Your fee estimate ' + ether_s + ' tETH / '+ wei_s + ' test wei' ;
                                                }
                                                message.push(send_msg) ;
                                            }
                                            if (request_money_bn) {
                                                ether_s = bn_toFixed(request_money_bn, 18, true) ;
                                                wei_bn = request_money_bn.multipliedBy(wei_factor) ;
                                                wei_s = bn_toFixed(wei_bn, 0, true) ;
                                                request_msg = 'Request ' + ether_s + ' tETH / '+ wei_s + ' test wei' + ' from ' + request.contact.alias + '?' ;
                                                // add fee info. paid by contact
                                                if (request_fee) {
                                                    wei_bn = new BigNumber(request_fee) ;
                                                    ether_bn = wei_bn.dividedBy(wei_factor) ;
                                                    ether_s = bn_toFixed(ether_bn, 18, true) ;
                                                    wei_s = bn_toFixed(wei_bn, 0, true) ;
                                                    request_msg += '<br>Contact fee estimate ' + ether_s + ' tETH / '+ wei_s + ' test wei' ;
                                                }
                                                message.push(request_msg) ;
                                            }
                                            message = message.join('<br>') ;

                                            // path 1) confirm box in w3
                                            ZeroFrame.cmd("wrapperConfirm", [message, 'OK'], function (confirm) {
                                                if (confirm_status.done) return; // confirm dialog done (OK or timeout)
                                                confirm_status.done = true ;
                                                if (!confirm) return send_response('money transaction(s) was/were rejected');
                                                // Money transaction was confirmed. continue
                                                step_3_check_balance();
                                            }) ;

                                            // path 2) confirm box in MN
                                            request2 = {
                                                msgtype: 'confirm',
                                                message: message,
                                                button_caption: 'OK'
                                            };
                                            console.log(pgm + 'sending request2 = ' + JSON.stringify(request2));
                                            encrypt2.send_message(request2, {response: 50000, group_debug_seq: group_debug_seq}, function (response) {
                                                try {
                                                    var pgm = service + '.process_incoming_message.' + request.msgtype + '.step_2_confirm send_message callback 3/' + group_debug_seq + ': ';
                                                    if (confirm_status.done) return; // confirm dialog done (OK or timeout)
                                                    confirm_status.done = true ;
                                                    // response should be OK or timeot
                                                    if (response && !response.error) {
                                                        // Money transaction was confirmed. continue
                                                        return step_3_check_balance() ;
                                                    }
                                                    if (response && response.error && response.error.match(/^Timeout /)) {
                                                        // OK. timeout after 50 seconds. No or late user feedback in MN session
                                                        return;
                                                    }
                                                    // unexpected response from confirm request
                                                    console.log(pgm + 'error: response = ' + JSON.stringify(response)) ;
                                                }
                                                catch (e) { return send_exception(pgm, e) }

                                            }); // send_message callback 3

                                        }) ; // optional_calc_request_fee callback 2

                                    }) ; // optional_calc_send_fee callback 1

                                }; // step_2_confirm

                                // prepare_mt_request step 1: optional open wallet. wallet must be open before estimate fee calculation
                                step_1_open_wallet = function () {
                                    if (wallet_info.status == 'Open') {
                                        // etherwallet is already open. never close an already open wallet
                                        request.close_wallet = false;
                                        // refresh balance. only for send money requests
                                        if (!send_money_bn) return step_2_confirm();
                                        // sending money. refresh balance.
                                        etherService.get_balance(function (error) {
                                            try {
                                                if (error) console.log(pgm + 'warning. sending money and get_balance request failed with error = ' + error);
                                                step_2_confirm();
                                            }
                                            catch (e) { return send_exception(pgm, e) }
                                        });
                                    }
                                    else {
                                        // open test etherwallet (also get_balance request)
                                        etherService.openWallet(status, function (error) {
                                            try {
                                                if (error && (wallet_info.status != 'Open')) {
                                                    z_wrapper_notification(['error', 'Open wallet request failed with<br>' + error]) ;
                                                    return send_response('Open wallet request failed with error = ' + error);
                                                }
                                                if (error && send_money_bn) console.log(pgm + 'warning. sending money and get_balance request failed with error = ' + error);
                                                step_2_confirm();
                                            }
                                            catch (e) { return send_exception(pgm, e) }
                                        });
                                    }
                                }; // step_1_open_wallet

                                // start callback chain
                                step_1_open_wallet();
                            }
                            catch (e) { return send_exception(pgm, e) }
                        })() ;
                        return;
                        // end prepare_mt_request
                    }
                    else if (request.msgtype == 'send_mt') {
                        // step 2 in send money transaction(s) to contact
                        // MN session has just sent chat msg with money transaction(s) to contact.
                        (function send_mt(){
                            try {
                                var pgm = service + '.process_incoming_message.' + request.msgtype + '/' + group_debug_seq + ': ';
                                var now, elapsed;
                                now = new Date().getTime();
                                if (!new_money_transactions[request.money_transactionid]) return send_response('Unknown money transactionid');
                                // max 60 seconds between prepare_mt_response and send_mt requests
                                elapsed = now - new_money_transactions[request.money_transactionid].timestamp;
                                if (elapsed > 60000) return send_response('Timeout. Waited ' + Math.round(elapsed / 1000) + ' seconds');

                                // OK send_mt request
                                console.log(pgm + 'sending OK response to ingoing send_mt request');
                                send_response(null, function () {

                                    try {
                                        var group_debug_seq, pgm, step_1_check_port, step_2_get_pubkey, step_3_get_pubkey2,
                                            step_4_save_in_ls, step_5_create_session, step_6_send_pubkeys_msg, step_7_save_in_ls,
                                            step_8_publish, session_info, i, money_transactions, encrypt3, reason, my_pubkey, my_pubkey2;

                                        // get a new group debug seq for send_mt post processing.
                                        group_debug_seq = MoneyNetworkAPILib.debug_group_operation_start();
                                        pgm = service + '.process_incoming_message.' + request.msgtype + ' send_response callback/' + group_debug_seq + ': ';
                                        console.log(pgm + 'OK send_mt response was send to MN. MN is sending chat msg with money transactions to contact. continue with send_mt post processing here in W3');
                                        console.log(pgm + 'Using group_debug_seq ' + group_debug_seq + ' for this post send_mt processing operation');

                                        // capture details for new wallet to wallet money transaction
                                        // must be temporary saved in localStorage until money transaction is processed
                                        session_info = {
                                            money_transactionid: request.money_transactionid,
                                            sender: true,
                                            contact: new_money_transactions[request.money_transactionid].request.contact,
                                            money_transactions: [],
                                            files: {}
                                        };
                                        money_transactions = new_money_transactions[request.money_transactionid].request.money_transactions;
                                        for (i = 0; i < money_transactions.length; i++) {
                                            session_info.money_transactions.push({
                                                action: money_transactions[i].action,
                                                code: money_transactions[i].code,
                                                amount: money_transactions[i].amount,
                                                json: new_money_transactions[request.money_transactionid].response.jsons[i]
                                            });
                                        }
                                        reason = request.msgtype ;

                                        // post send_mt tasks. create callback chain step 1-8

                                        // send_mt step 8: publish
                                        step_8_publish = function () {
                                            var pgm = service + '.process_incoming_message.' + request.msgtype + '.step_8_publish/' + group_debug_seq + ': ';
                                            console.log(pgm + 'publish pubkeys message for other wallet session. publishing via MN publish queue. max one publish once every 30 seconds');
                                            z_publish({publish: true, reason: reason, group_debug_seq: group_debug_seq});
                                        }; // step_8_publish

                                        // send_mt step 7: update session and money transaction(s) in ls
                                        step_7_save_in_ls = function () {
                                            var pgm = service + '.process_incoming_message.' + request.msgtype + '.step_7_save_in_ls/' + group_debug_seq + ': ';
                                            save_w_session(session_info, {group_debug_seq: group_debug_seq}, function () {
                                                try {
                                                    console.log(pgm + 'OK. Updated wallet-wallet session information in localStorage');
                                                    step_8_publish();
                                                }
                                                catch (e) { return send_exception(pgm, e) }
                                            });
                                        }; // step_7_save_in_ls

                                        // send_mt step 6. send offline pubkeys message to other wallet session
                                        step_6_send_pubkeys_msg = function () {
                                            var pgm = service + '.process_incoming_message.' + request.msgtype + '.step_6_send_pubkeys_msg/' + group_debug_seq + ': ';
                                            var request2, error, options;
                                            request2 = {
                                                msgtype: 'w3_pubkeys',
                                                pubkey: my_pubkey, // for JSEncrypt
                                                pubkey2: my_pubkey2 // for cryptMessage
                                            };
                                            console.log(pgm + 'request2 = ' + JSON.stringify(request2));
                                            // send offline message. no wait for response. use optional offline file (-o) or normal file
                                            options = {
                                                encryptions: [3],
                                                optional: session_info.ip_external ? 'o' : null,
                                                subsystem: 'w3',
                                                files: session_info.files,
                                                status: '1: pubkeys sent, waiting for w3_check_mt',
                                                group_debug_seq: group_debug_seq
                                            } ;
                                            try {
                                                encrypt3.send_message(request2, options, function (response2, request_filename) {
                                                    var pgm, error ;
                                                    try {
                                                        pgm = service + '.process_incoming_message.' + request.msgtype + '.step_6_send_pubkeys_msg send_message/' + group_debug_seq + ': ';
                                                        if (!response2 || response2.error) {
                                                            error = ['Money transaction post processing failed', 'pubkeys message was not send', 'error = ' + JSON.stringify(response2)];
                                                            report_error(pgm, error, {group_debug_seq: group_debug_seq}) ;
                                                            return;
                                                        }
                                                        console.log(pgm + 'response2        = ' + JSON.stringify(response2));
                                                        console.log(pgm + 'request_filename = ' + JSON.stringify(request_filename));
                                                        console.log(pgm + 'sent pubkeys message to other wallet session');
                                                        if (!ls.w_files) ls.w_files = {} ;
                                                        ls.w_files[request_filename] = true ;
                                                        reason = request_filename ;
                                                        session_info.this_status = options.status ;
                                                        step_7_save_in_ls();
                                                    }
                                                    catch (e) { return send_exception(pgm, e) }
                                                }); // encrypt_json callback
                                            }
                                            catch (e) { return send_exception(pgm, e)}

                                        }; // step_6_send_pubkeys_msg

                                        // send_mt step 5. create wallet to wallet session. expects incoming pubkeys message from other wallet session
                                        step_5_create_session = function () {
                                            var pgm = service + '.process_incoming_message.' + request.msgtype + '.step_5_create_session/' + group_debug_seq + ': ';
                                            // setup session instance.
                                            // Only using symmetric encryption in first pubkeys message to other wallet session
                                            // this wallet starts the transaction and is the sender in wallet to wallet communication
                                            encrypt3 = new MoneyNetworkAPI({
                                                debug: 'encrypt3',
                                                sessionid: session_info.money_transactionid,
                                                sender: true,
                                                prvkey: session_info.prvkey,
                                                userid2: session_info.userid2
                                            });
                                            console.log(pgm + 'created wallet-wallet session. waiting for pubkeys message from other wallet session');
                                            step_6_send_pubkeys_msg();
                                        }; // step_5_create_session

                                        step_4_save_in_ls = function () {
                                            var pgm = service + '.process_incoming_message.' + request.msgtype + '.step_4_save_in_ls/' + group_debug_seq + ': ';
                                            save_w_session(session_info, {group_debug_seq: group_debug_seq}, function () {
                                                try {
                                                    console.log(pgm + 'OK. Created wallet-wallet session information in localStorage');
                                                    step_5_create_session();
                                                }
                                                catch (e) { return send_exception(pgm, e) }
                                            });
                                        }; // step_4_save_in_ls

                                        // send_mt step 3. generate public/private keyset for wallet to wallet communication. cryptMessage. encryption layer 2
                                        step_3_get_pubkey2 = function () {
                                            var pgm = service + '.process_incoming_message.' + request.msgtype + '.step_3_get_pubkey2/' + group_debug_seq + ': ';
                                            var r, debug_seq;
                                            r = Math.random();
                                            session_info.userid2 = parseInt(('' + r).substr(2, 3)); // 0-999
                                            debug_seq = MoneyNetworkAPILib.debug_z_api_operation_start(pgm, null, 'userPublickey', null, group_debug_seq);
                                            ZeroFrame.cmd("userPublickey", [session_info.userid2], function (pubkey2) {
                                                try {
                                                    MoneyNetworkAPILib.debug_z_api_operation_end(debug_seq, pubkey2 ? 'OK' : 'Error. Not found');
                                                    my_pubkey2 = pubkey2;
                                                    console.log(pgm + 'Generated new cryptMessage pubkey/prvkey set');
                                                    // console.log(pgm + 'session_info = ' + JSON.stringify(session_info));
                                                    step_4_save_in_ls();
                                                }
                                                catch (e) { return send_exception(pgm, e) }
                                            }); // userPublickey
                                        }; // step_3_get_pubkey2

                                        // send_mt step 2. generate public/private keyset for wallet to wallet communication. JSEncrypt. encryption layer 1
                                        step_2_get_pubkey = function () {
                                            var pgm = service + '.process_incoming_message.' + request.msgtype + '.step_2_get_pubkey/' + group_debug_seq + ': ';
                                            var crypt;
                                            crypt = new JSEncrypt({default_key_size: 1024});
                                            crypt.getKey();
                                            my_pubkey = crypt.getPublicKey();
                                            session_info.prvkey = crypt.getPrivateKey();
                                            console.log(pgm + 'Generated new JSEncrypt pubkey/prvkey set');
                                            step_3_get_pubkey2();
                                        }; // step_2_get_pubkey

                                        // send_mt step 1. check if zeronet port is open. required for optional files distribution (money transactions)
                                        step_1_check_port = function () {
                                            var pgm = service + '.process_incoming_message.' + request.msgtype + '.step_1_check_port/' + group_debug_seq + ': ';
                                            check_port(pgm, session_info, group_debug_seq, send_exception, step_2_get_pubkey) ;
                                        }; // step_1_check_port

                                        // start callback chain
                                        step_1_check_port();
                                    }
                                    catch (e) { return send_exception(pgm, e) }
                                }); // send_response callback
                            }
                            catch (e) { return send_exception(pgm, e) }
                        })() ;
                        return ;
                        // end send_mt
                    }
                    else if (request.msgtype == 'check_mt') {
                        // step 3 in send money transaction(s) to contact
                        // MN session has received chat msg with money transaction(s) from contact and user has clicked Approve.
                        // Check if incoming money transaction is OK
                        (function check_mt(){
                            try {
                                var send_money_bn, request_money_bn, jsons, i, money_transaction, step_1_load_session, step_3_confirm,
                                    step_2_open_wallet, step_4_check_balance, step_5_get_new_address, step_6_done, amount2;

                                console.log(pgm + 'request = ' + JSON.stringify(request));
                                //request = {
                                //    "msgtype": "check_mt",
                                //    "contact": {
                                //        "alias": "1MirY1KnJK3MK",
                                //        "cert_user_id": "1MirY1KnJK3MK@moneynetwork.bit",
                                //        "auth_address": "1MirY1KnJK3MKzgZiyZZM8FkyzHRJgmMh8"
                                //    },
                                //    "open_wallet": true,
                                //    "money_transactions": [{
                                //        "action": "Send",
                                //        "code": "tBTC",
                                //        "amount": 0.0001,
                                //        "json": {"return_address": "2Mxufcnyzo8GvTGHqYfzS862ZqYaFYjxo5V"}
                                //    }],
                                //    "money_transactionid": "3R1R46sRFEal8zWx0wYvYyo6VDLJmpFzVNsyIOhglPV4bcUgXqUDLOWrOkZA"
                                //};

                                // check amount. must be a number (round to 18 decimals) or a string with 18 decimals
                                for (i = 0; i < request.money_transactions.length; i++) {
                                    money_transaction = request.money_transactions[i];
                                    if (typeof money_transaction.amount == 'number') money_transaction.amount.toFixed(18);
                                    else {
                                        // string. must be ether amount with 18 decimals
                                        amount2 = parseFloat(money_transaction.amount).toFixed(18) ;
                                        if (money_transaction.amount != amount2) return send_response('Expected amount in ether with 18 decimals. "' + money_transaction.amount + '" != "' + amount2 + '"') ;
                                    }
                                }

                                // check permissions. reverse action from incoming money transaction (send <=> request)
                                send_money_bn = null;
                                request_money_bn = null;
                                jsons = [];
                                for (i = 0; i < request.money_transactions.length; i++) {
                                    money_transaction = request.money_transactions[i];
                                    if (!money_transaction.json) return send_response('Invalid money transaction without json');
                                    amount2 = new BigNumber(money_transaction.amount) ;
                                    if (money_transaction.action == 'Send') {
                                        if (!money_transaction.json.return_address) return send_response('Invalid send money transaction without a return address');
                                        if (!request_money_bn) request_money_bn = new BigNumber(0) ;
                                        request_money_bn = request_money_bn.plus(amount2);
                                    } // reverse action
                                    if (money_transaction.action == 'Request') {
                                        if (!money_transaction.json.address) return send_response('Invalid request money transaction without an address');
                                        if (!send_money_bn) send_money_bn = new BigNumber(0) ;
                                        send_money_bn = send_money_bn.plus(amount2);
                                    } // reverse action
                                    jsons.push({});
                                }
                                console.log(pgm + 'send_money = ' + (send_money_bn ? send_money_bn.toFixed(10) : null) + ', request_money = ' + (request_money_bn ? request_money_bn.toFixed(10) : null));
                                if (send_money_bn && (!status.permissions || !status.permissions.send_money)) return send_response('send_money operation is not authorized');
                                if (request_money_bn && (!status.permissions || !status.permissions.receive_money)) return send_response('receive_money operation is not authorized');
                                // aray with empty jsons - see step_5_get_new_address
                                console.log(pgm + 'jsons (empty json array) = ' + JSON.stringify(jsons)) ;

                                // check_mt step 6:
                                step_6_done = function () {
                                    var pgm = service + '.process_incoming_message.' + request.msgtype + '.step_6_done/' + group_debug_seq + ': ';
                                    var error, i, money_transaction;
                                    console.log(pgm + 'request = ' + JSON.stringify(request));
                                    //request = {
                                    //    "msgtype": "check_mt",
                                    //    "contact": {
                                    //        "alias": "1MirY1KnJK3MK",
                                    //        "cert_user_id": "1MirY1KnJK3MK@moneynetwork.bit",
                                    //        "auth_address": "1MirY1KnJK3MKzgZiyZZM8FkyzHRJgmMh8"
                                    //    },
                                    //    "open_wallet": true,
                                    //    "money_transactions": [{
                                    //        "action": "Send",
                                    //        "code": "tBTC",
                                    //        "amount": 0.0001,
                                    //        "json": {"return_address": "2Mxufcnyzo8GvTGHqYfzS862ZqYaFYjxo5V"}
                                    //    }],
                                    //    "money_transactionid": "3R1R46sRFEal8zWx0wYvYyo6VDLJmpFzVNsyIOhglPV4bcUgXqUDLOWrOkZA"
                                    //};
                                    console.log(pgm + 'jsons (one address per money transaction) = ' + JSON.stringify(jsons));
                                    //jsons = [{"address": "2MtDgneBKY5AaiJBEFWQFnACu9kuNqLCpNG"}];

                                    // control. there should be an address and a return_address for each money transaction
                                    // address: for send money operation
                                    // return_address: used in case of partial failed money transactions (multiple money transaction in a chat message)
                                    if (jsons.length != request.money_transactions.length) {
                                        error = 'System error in check_mt processing. Expected request.money_transactions.length = ' + request.money_transactions.length + '. found jsons.length = ' + jsons.length;
                                        console.log(pgm + error);
                                        return send_response(error);
                                    }
                                    for (i = 0; i < request.money_transactions.length; i++) {
                                        money_transaction = request.money_transactions[i];
                                        if (money_transaction.action == 'Send') {
                                            // received a send money transaction from other contact
                                            // expects a return_address in request and expects an address in jsons
                                            if (!money_transaction.json || !money_transaction.json.return_address || !jsons[i].address) {
                                                error = 'System error in check_mt processing. Expected addresses were not found. Action = ' + money_transaction.action + ', money_transaction.json = ' + JSON.stringify(money_transaction.json) + ', jsons[' + i + '] = ' + JSON.stringify(jsons[i]);
                                                console.log(pgm + error);
                                                return send_response(error);
                                            }
                                        }
                                        else {
                                            // received a request money transaction from other contact
                                            // expects an address in request and a return_address in jsons
                                            if (!money_transaction.json || !money_transaction.json.address || !jsons[i].return_address) {
                                                error = 'System error in check_mt processing. Expected addresses were not found. Action = ' + money_transaction.action + ', money_transaction.json = ' + JSON.stringify(money_transaction.json) + ', jsons[' + i + '] = ' + JSON.stringify(jsons[i]);
                                                console.log(pgm + error);
                                                return send_response(error);
                                            }
                                        }
                                    }

                                    // ready to send OK response to MN
                                    // temporary remember request and new addresses (jsons) and wait for start_mt request (all validations OK and ready to execute money transactions)
                                    new_money_transactions[request.money_transactionid] = {
                                        timestamp: new Date().getTime(),
                                        request: request,
                                        jsons: jsons
                                    };
                                    console.log(pgm + 'new_money_transactions = ' + JSON.stringify(new_money_transactions));
                                    //new_money_transactions = {
                                    //    "3R1R46sRFEal8zWx0wYvYyo6VDLJmpFzVNsyIOhglPV4bcUgXqUDLOWrOkZA": {
                                    //        "timestamp": 1508858239692,
                                    //        "request": {
                                    //            "msgtype": "check_mt",
                                    //            "contact": {
                                    //                "alias": "1MirY1KnJK3MK",
                                    //                "cert_user_id": "1MirY1KnJK3MK@moneynetwork.bit",
                                    //                "auth_address": "1MirY1KnJK3MKzgZiyZZM8FkyzHRJgmMh8"
                                    //            },
                                    //            "open_wallet": true,
                                    //            "money_transactions": [{
                                    //                "action": "Send",
                                    //                "code": "tBTC",
                                    //                "amount": 0.0001,
                                    //                "json": {"return_address": "2Mxufcnyzo8GvTGHqYfzS862ZqYaFYjxo5V"}
                                    //            }],
                                    //            "money_transactionid": "3R1R46sRFEal8zWx0wYvYyo6VDLJmpFzVNsyIOhglPV4bcUgXqUDLOWrOkZA"
                                    //        },
                                    //        "jsons": [{"address": "2Myvri78Uh6aTXsVT9u3qELwqbuQ5sU2WCF"}]
                                    //    }
                                    //};
                                    send_response(null);

                                }; // step_6_done

                                // check_mt step 5: get ether wallet address
                                // - send money - address to be used in send money operation (return_address is already in request)
                                // - request money - return address to be used in case of a partly failed money transaction (address is already in request)
                                step_5_get_new_address = function (i) {
                                    var pgm = service + '.process_incoming_message.' + request.msgtype + '.step_5_get_new_address/' + group_debug_seq + ': ';
                                    var money_transaction;
                                    if (!i) i = 0;
                                    console.log(pgm + 'i = ' + i);
                                    if (i >= request.money_transactions.length) return step_6_done();
                                    money_transaction = request.money_transactions[i];
                                    // check old session info
                                    if ((money_transaction.action == 'Send') && (jsons[i].address)) {
                                        // address already added. loaded from old session info in step_1_load_session
                                        return step_5_get_new_address(i + 1) ;
                                    }
                                    if ((money_transaction.action == 'Request') && (jsons[i].return_address)) {
                                        // return_address already added. loaded from old session info in step_1_load_session
                                        return step_5_get_new_address(i + 1) ;
                                    }
                                    // get ether wallet address
                                    etherService.get_address(function (error, address) {
                                        try {
                                            if (error) return send_response('Could not find ether wallet address. error = ' + error);
                                            if (money_transaction.action == 'Send') jsons[i].address = address; // ingoing send money: other wallet must send test ethers to this address
                                            else jsons[i].return_address = address; // ingoing request money. address is already in request. other wallet must use return_address in case of a failed money transfer operation
                                            step_5_get_new_address(i + 1);
                                        }
                                        catch (e) { return send_exception(pgm, e) }
                                    }); // get_new_address
                                }; // step_5_get_new_address

                                // check_mt step 4: optional check balance. Only for request money operations
                                step_4_check_balance = function () {
                                    var pgm = service + '.process_incoming_message.' + request.msgtype + '.step_4_check_balance/' + group_debug_seq + ': ';
                                    var wei_bn, wei_s ;
                                    if (!send_money_bn) return step_5_get_new_address();
                                    console.log(pgm + 'sending money. check wallet balance. send_money = ' + send_money_bn + ', balance: ', wallet_info.confirmed_balance + ', unconfirmed Balance: ', wallet_info.unconfirmed_balance);

                                    try {
                                        wei_bn = send_money_bn.multipliedBy(wei_factor) ;
                                        wei_s = bn_toFixed(wei_bn, 0, false) ;
                                        etherService.estimate_fee(null, wei_s, function (fee, gas_estimate, gas_price) {
                                            var pgm, send_money_with_fee_bn, confirmed_balance_bn, unconfirmed_balance_bn ;
                                            try {
                                                pgm = service + '.process_incoming_message.' + request.msgtype + '.step_4_check_balance estimate_fee callback/' + group_debug_seq + ': ';

                                                if (!fee) console.log(pgm + 'error. could not estimate gas fee') ;
                                                if (!fee) fee = 0 ;
                                                fee = new BigNumber(fee) ;
                                                send_money_with_fee_bn = send_money_bn.plus(fee) ;
                                                confirmed_balance_bn = new BigNumber(wallet_info.confirmed_balance) ;
                                                if (confirmed_balance_bn.gte(send_money_with_fee_bn)) return step_5_get_new_address(); // OK
                                                unconfirmed_balance_bn = new BigNumber(wallet_info.unconfirmed_balance) ;
                                                if (unconfirmed_balance_bn.lt(send_money_with_fee_bn)) send_response('insufficient balance for money request(s)');
                                                else send_response('insufficient balance confirmed balance for money request(s)');

                                            }
                                            catch (e) { return send_exception(pgm, e) }

                                        }) ; // estimate_fee callback 1

                                    }
                                    catch (e) { return send_exception(pgm, e) }

                                }; // step_4_check_balance

                                // check_mt step 3: receiver - optional confirm money transaction (see permissions)
                                step_3_confirm = function () {
                                    var pgm = service + '.process_incoming_message.' + request.msgtype + '.step_2_confirm/' + group_debug_seq + ': ';
                                    var optional_calc_send_fee, send_fee, optional_calc_request_fee, request_fee, request2;
                                    if (wallet_info.status != 'Open') {
                                        // wallet not open (not created, not logged in etc)
                                        if (!status.permissions.open_wallet) return send_response('Cannot receive money transaction. Open wallet operation is not authorized');
                                        if (!request.open_wallet) return send_response('Cannot receive money transaction. Wallet is not open and open_wallet was not requested');
                                        else if (etherService.is_login_info_missing(status)) return send_response('Cannot receive money transaction. Wallet is not open and no wallet login was found');
                                    }
                                    if (request.close_wallet && !status.permissions.close_wallet) return send_response('Cannot receive money transaction. Close wallet operation was requested but is not authorized');
                                    console.log(pgm + 'todo: add transactions details in confirm dialog');
                                    if (!status.permissions.confirm) return step_4_check_balance();

                                    // calculate fees
                                    optional_calc_send_fee = function (cb) {
                                        var wei_bn, wei_s ;
                                        if (!send_money_bn) return cb() ;
                                        wei_bn = send_money_bn.multipliedBy(wei_factor) ;
                                        wei_s = bn_toFixed(wei_bn, 0, false) ;
                                        etherService.estimate_fee(null, wei_s, function (fee, gas_estimate, gas_price) {
                                            send_fee = fee ;
                                            cb() ;
                                        }) ;
                                    } ; // optional_calc_send_fee
                                    optional_calc_request_fee = function (cb) {
                                        var wei_bn, wei_s ;
                                        if (!request_money_bn) return cb() ;
                                        wei_bn = request_money_bn.multipliedBy(wei_factor) ;
                                        wei_s = bn_toFixed(wei_bn, 0, false) ;
                                        etherService.estimate_fee(null, wei_s, function (fee, gas_estimate, gas_price) {
                                            request_fee = fee ;
                                            cb() ;
                                        }) ;
                                    } ; // optional_calc_request_fee

                                    optional_calc_send_fee(function() {
                                        var pgm = service + '.process_incoming_message.' + request.msgtype + '.step_3_confirm optional_calc_send_fee callback 1/' + group_debug_seq + ': ';
                                        optional_calc_request_fee(function () {
                                            var pgm = service + '.process_incoming_message.' + request.msgtype + '.step_3_confirm optional_calc_request_fee callback 2/' + group_debug_seq + ': ';

                                            var confirm_status, confirm_timeout_fnk, ether_bn, ether_s, wei_bn, wei_s, send_msg, request_msg, message, request2 ;

                                            // ready for confirm dialog
                                            // open two confirm dialog boxes.
                                            // one here in W3 session. The other in MN session
                                            // timeout in prepare_mt_request request from MN is 60 seconds.
                                            // timeout in confirm dialog box is 50 seconds
                                            confirm_status = {done: false};
                                            confirm_timeout_fnk = function () {
                                                if (confirm_status.done) return; // confirm dialog done
                                                confirm_status.done = true;
                                                send_response('Confirm transaction timeout')
                                            };
                                            setTimeout(confirm_timeout_fnk, 50000);

                                            // create confirm message with fee info
                                            message = [] ;
                                            if (send_money_bn) {
                                                ether_s = bn_toFixed(send_money_bn, 18, true) ;
                                                wei_bn = send_money_bn.multipliedBy(wei_factor) ;
                                                wei_s = bn_toFixed(wei_bn, 0, true) ;
                                                send_msg = 'Send ' + ether_s + ' tETH / '+ wei_s + ' test wei' + ' to ' + request.contact.alias + '?' ;
                                                // add fee info. paid by sender
                                                if (send_fee) {
                                                    wei_bn = new BigNumber(send_fee) ;
                                                    ether_bn = wei_bn.dividedBy(wei_factor) ;
                                                    ether_s = bn_toFixed(ether_bn, 18, true) ;
                                                    wei_s = bn_toFixed(wei_bn, 0, true) ;
                                                    send_msg += '<br>Your fee estimate ' + ether_s + ' tETH / '+ wei_s + ' test wei' ;
                                                }
                                                message.push(send_msg) ;
                                            }
                                            if (request_money_bn) {
                                                ether_s = bn_toFixed(request_money_bn, 18, true) ;
                                                wei_bn = request_money_bn.multipliedBy(wei_factor) ;
                                                wei_s = bn_toFixed(wei_bn, 0, true) ;
                                                request_msg = 'Receive ' + ether_s + ' tETH / '+ wei_s + ' test wei' + ' from ' + request.contact.alias + '?' ;
                                                // add fee info. paid by contact
                                                if (request_fee) {
                                                    wei_bn = new BigNumber(request_fee) ;
                                                    ether_bn = wei_bn.dividedBy(wei_factor) ;
                                                    ether_s = bn_toFixed(ether_bn, 18, true) ;
                                                    wei_s = bn_toFixed(wei_bn, 0, true) ;
                                                    request_msg += '<br>Contact fee estimate ' + ether_s + ' tETH / '+ wei_s + ' test wei' ;
                                                }
                                                message.push(request_msg) ;
                                            }
                                            message = message.join('<br>') ;

                                            // path 1) confirm box in w3
                                            ZeroFrame.cmd("wrapperConfirm", [message, 'OK'], function (confirm) {
                                                if (confirm_status.done) return; // confirm dialog done (OK or timeout)
                                                confirm_status.done = true ;
                                                if (!confirm) return send_response('money transaction(s) was/were rejected');
                                                // Money transaction was confirmed. continue
                                                step_4_check_balance();
                                            }) ;

                                            // path 2) confirm box in MN
                                            request2 = {
                                                msgtype: 'confirm',
                                                message: message,
                                                button_caption: 'OK'
                                            };
                                            console.log(pgm + 'sending request2 = ' + JSON.stringify(request2));
                                            encrypt2.send_message(request2, {response: 50000, group_debug_seq: group_debug_seq}, function (response) {
                                                try {
                                                    var pgm = service + '.process_incoming_message.' + request.msgtype + '.step_3_confirm send_message callback 3/' + group_debug_seq + ': ';
                                                    if (confirm_status.done) return; // confirm dialog done (OK or timeout)
                                                    confirm_status.done = true ;
                                                    // response should be OK or timeot
                                                    if (response && !response.error) {
                                                        // Money transaction was confirmed. continue
                                                        return step_4_check_balance() ;
                                                    }
                                                    if (response && response.error && response.error.match(/^Timeout /)) {
                                                        // OK. timeout after 50 seconds. No or late user feedback in MN session
                                                        return;
                                                    }
                                                    // unexpected response from confirm request
                                                    console.log(pgm + 'error: response = ' + JSON.stringify(response)) ;
                                                }
                                                catch (e) { return send_exception(pgm, e) }

                                            }); // send_message callback 3

                                        }); // optional_calc_request_fee callback 2

                                    }) ; // optional_calc_send_fee callback 1



                                }; // step_3_confirm

                                // check_mt step 2: optional open wallet. wallet must be open before estimate fee calculation
                                step_2_open_wallet = function () {
                                    var pgm = service + '.process_incoming_message.' + request.msgtype + '.step_2_open_wallet/' + group_debug_seq + ': ';
                                    if (wallet_info.status == 'Open') {
                                        // ether wallet is already open. never close an already open wallet
                                        request.close_wallet = false;
                                        // check balance. only incoming request money transactions
                                        if (!send_money_bn) return step_3_confirm();
                                        // sending money. refresh balance.
                                        etherService.get_balance(function (error) {
                                            try {
                                                if (error) console.log(pgm + 'warning. money request and get_balance request failed with error = ' + error);
                                                return step_3_confirm();
                                            }
                                            catch (e) { return send_exception(pgm, e) }
                                        });
                                    }
                                    else {
                                        // open test ether wallet (also get_balance request)
                                        etherService.openWallet(status, function (error) {
                                            try {
                                                if (error && (wallet_info.status != 'Open')) return send_response('Open wallet request failed with error = ' + error);
                                                if (error && send_money_bn) console.log(pgm + 'warning. money request and get_balance request failed with error = ' + error);
                                                step_3_confirm();
                                            }
                                            catch (e) { return send_exception(pgm, e) }
                                        });
                                    }
                                }; // step_2_open_wallet

                                // check_mt step 1: load old wallet session from ls. only in case of retry approve incoming money transactions
                                step_1_load_session = function () {
                                    var pgm = service + '.process_incoming_message.' + request.msgtype + '.step_1_load_old_session/' + group_debug_seq + ': ';
                                    console.log(pgm + 'load any old transaction information for this transactionid from ls. maybe a second approve money transaction');
                                    read_w_session(request.money_transactionid, {group_debug_seq: group_debug_seq}, function (old_session_info) {
                                        try {
                                            var i, old_money_transaction ;
                                            if (!old_session_info) return step_2_open_wallet();

                                            console.log(pgm + 'warning. found old wallet session in ls. old_session_info = ' + JSON.stringify(old_session_info));
                                            //old_session_info = {
                                            //    "money_transactionid": "dGvvnMydn8HLhCkInrLLJU3pxMljoWlGEow2GqbZfnDf1WzFeLERtoAI3r50",
                                            //    "sender": false,
                                            //    "contact": {
                                            //        "alias": "jro",
                                            //        "cert_user_id": "jro@zeroid.bit",
                                            //        "auth_address": "18DbeZgtVCcLghmtzvg4Uv8uRQAwR8wnDQ"
                                            //    },
                                            //    "money_transactions": [{
                                            //        "action": "Send",
                                            //        "code": "tBTC",
                                            //        "amount": 0.001,
                                            //        "json": {
                                            //            "return_address": "2NEu38hyH9f5oLjekWZEERjWoEoCRRdzWfn",
                                            //            "address": "2Mt1mLHk3F9H12PoP5UUSTdPqfqXgnSTc5i"
                                            //        }
                                            //    }],
                                            //    "ip_external": false,
                                            //    "prvkey": "-----BEGIN RSA PRIVATE KEY-----\nMIICXQIBAAKBgQCmh3aLbQazJ5+NjHCQi1w0N4uU1GAEAqGB8lX3dS+NF9AGu8xO\nfpjBdFPZVx/Kqe0KbVTPHvdIYWyhwblPSZS9F/mqtlMYxSKuN2Nr0mZmfX0LsobY\n/eYMwXiTY8osMjh7rZsXQUtsBZqJg5opaJISn1AEBSLNt1gTEggvgRrW7wIDAQAB\nAoGBAIeXsQxhn5zsXFuyyEzJTDAwMfTi37MkOUFHgnvU7PzjMLzq2LXpGpQaFdPX\nvskThzCASRfETPCgcwVaaXqHnRTyXXQcqEfe8pAKidbleViH/TcGClWOg0KDKA57\nlv8hlk59dLFi8BMbNlvjcbUZsysV8UV8KWxNu6SFsmD9eB2xAkEAzswzzJ95NzYR\n1olLL6Le66w5hHQjyygJxqQXpf/DvaHhMdAZ1nJV36N9IWfSCpsRRqiwk9401piW\n0Cj1i/mKfQJBAM4mjc4/uYCnCyLLDoOxzFuztwosGQJhW+I0+IiZbrfScjSfT2XB\ndrvAsDT1eoQLpkumoNZRBTBFMqiPro4HNtsCQQCNooJfxWGqFNhGzaW3LJ/tXfnO\n5BSX0gZQDJc91FzmBndMPLFVlN2H3FuZg5fyN56vfF3kCK67w6qXS1ZR1kmpAkBO\nbnCpNal3/xXHiQXeqPidMwTCxABH3Y69w3WDUwzCtzhoOOxWRILN8AOaQoL4Vg5Q\n3fZ3U5/ru4gIhZHdy3TdAkAERv5x7XQXEFAhvyM6Ch1zA2Mc0p5kcvyOH6JLUdtB\n5WJ/Dv8opbSD/jeHS7KV3bp/llMrSkFaoFPI8X6iRyC/\n-----END RSA PRIVATE KEY-----",
                                            //    "userid2": 461
                                            //};

                                            if (old_session_info.pubkeys_sent_at) {
                                                return send_response('Money transaction is already approved') ;
                                            }

                                            // use old addresses from old_session_info.money_transactions.json. step_5_get_new_address must use old addresses, not request new addresses
                                            console.log(pgm + 'jsons (empty jsons) = ' + JSON.stringify(jsons)) ;
                                            //jsons (empty jsons) = [{}];

                                            if (old_session_info.money_transactions.length != jsons.length) {
                                                return send_response(
                                                    'Money transaction failed. Found old session information with an other number of transactions. ' +
                                                    old_session_info.money_transactions.length + 'row(s) in old session info. ' +
                                                    jsons.length + ' row(s) in this money transaction');
                                            }
                                            for (i=0 ; i < jsons.length ; i++) {
                                                old_money_transaction = old_session_info.money_transactions[i] ;
                                                if (old_money_transaction.action == 'Send') {
                                                    // other contact is sending test ethers to this session.
                                                    // return_address in incoming money transaction and address must be added by this session
                                                    // but use any already generated address from old session info
                                                    if (old_money_transaction.json.address) jsons[i].address = old_money_transaction.json.address ;
                                                }
                                                else {
                                                    // other contact is requesting test ethers from this session.
                                                    // address in incoming money transaction and return_address must be added by this session
                                                    // but use any already generated return_address from old session info
                                                    if (old_money_transaction.json.return_address) jsons[i].return_address = old_money_transaction.json.return_address ;
                                                }
                                            } // for i
                                            console.log(pgm + 'jsons (with old addresses) = ' + JSON.stringify(jsons)) ;

                                            // todo: skip step_3_open_wallet if ether address was found in old session info

                                            step_2_open_wallet();
                                        }
                                        catch (e) { return send_exception(pgm, e) }
                                    }); // read_w_session callback

                                }; // step_1_load_session

                                // start callback chain
                                step_1_load_session();
                            }
                            catch (e) { return send_exception(pgm, e) }
                        })() ;
                        return ;
                        // end check_mt
                    }
                    else if (request.msgtype == 'start_mt') {
                        // step 4 in send money transaction(s) to contact
                        // received money transaction(s) has been checked by wallet(s) with OK response
                        // MN session sends start money transaction signal to wallet(s)
                        // rest of money transaction process should be 100% wallet to wallet communication
                        // MN clients should be informed about status changes in money transactions
                        // MN clients may send a cancel signal to wallet(s)
                        // wallets may allow a MN cancel signal to abort money transaction processing
                        (function start_mt() {
                            try {
                                var pgm = service + '.process_incoming_message.' + request.msgtype + '/' + group_debug_seq + ': ';
                                var now, elapsed;
                                now = new Date().getTime();
                                if (!new_money_transactions[request.money_transactionid]) return send_response('Unknown money transactionid');
                                // max 60 seconds between check_mt and send_mt requests
                                elapsed = now - new_money_transactions[request.money_transactionid].timestamp;
                                if (elapsed > 60000) return send_response('Timeout. Waited ' + Math.round(elapsed / 1000) + ' seconds');

                                // OK start_mt request
                                console.log(pgm + 'sending OK response to ingoing start_mt request');
                                send_response(null, function () {
                                    try {
                                        // OK send_mt response has been sent to mn. get a new group debug seq for this start_mt post processing.
                                        var group_debug_seq, pgm;
                                        group_debug_seq = MoneyNetworkAPILib.debug_group_operation_start();
                                        pgm = service + '.process_incoming_message.' + request.msgtype + ' send_response callback 1/' + group_debug_seq + ': ';
                                        console.log(pgm + 'OK start_mt response was send to MN. continue with start_mt post processing');
                                        console.log(pgm + 'Using group_debug_seq ' + group_debug_seq + ' for this post start_mt processing operation');

                                        // normally no session_info in localStarage at start for start_mt post processing.
                                        // but check any way. Maybe a second approve incoming money transaction try
                                        read_w_session(request.money_transactionid, {group_debug_seq: group_debug_seq}, function (old_session_info)  {
                                            try {
                                                pgm = service + '.process_incoming_message.' + request.msgtype + ' read_w_session callback 2/' + group_debug_seq + ': ';
                                                var step_1_check_port, step_2_get_pubkey, step_3_get_pubkey2, step_4_save_in_ls, step_5_create_session,
                                                    step_6_send_pubkeys_msg, step_7_save_in_ls, step_8_publish, i, money_transactions,
                                                    jsons, money_transaction, key, encrypt4, new_session_info, session_info, readonly_keys,
                                                    null_keys, errors, request2, reason, my_pubkey, my_pubkey2 ;

                                                if (old_session_info) {
                                                    console.log(pgm + 'warning. found old session info in localStorage. old_session_info = ' + JSON.stringify(old_session_info)) ;
                                                    if (old_session_info.pubkeys_sent_at) {
                                                        error = ['Stopping post start_mt processing', 'pubkeys message has already been sent to other wallet'] ;
                                                        return report_error(pgm, error, {group_debug_seq: group_debug_seq}) ;
                                                    }
                                                    console.log(pgm + 'continue with old session info. cross checking old and new session info. should be identical') ;
                                                }

                                                // capture details for new wallet to wallet money transaction
                                                // must be temporary saved in localStorage until money transaction is processed
                                                // request.contact = {"alias":"1MirY1KnJK3MK","cert_user_id":"1MirY1KnJK3MK@moneynetwork.bit","auth_address":"1MirY1KnJK3MKzgZiyZZM8FkyzHRJgmMh8"}
                                                new_session_info = {
                                                    money_transactionid: request.money_transactionid,
                                                    sender: false,
                                                    contact: new_money_transactions[request.money_transactionid].request.contact,
                                                    money_transactions: [],
                                                    files: {}
                                                };
                                                money_transactions = new_money_transactions[request.money_transactionid].request.money_transactions;
                                                jsons = new_money_transactions[request.money_transactionid].jsons;
                                                for (i = 0; i < money_transactions.length; i++) {
                                                    money_transaction = {
                                                        action: money_transactions[i].action,
                                                        code: money_transactions[i].code,
                                                        amount: money_transactions[i].amount,
                                                        json: {}
                                                    };
                                                    for (key in money_transactions[i].json)  money_transaction.json[key] = money_transactions[i].json[key];
                                                    for (key in jsons[i]) money_transaction.json[key] = jsons[i][key];
                                                    new_session_info.money_transactions.push(money_transaction);
                                                }
                                                console.log(pgm + 'new_session_info = ' + JSON.stringify(new_session_info));
                                                //session_info = {
                                                //    "money_transactionid": "3R1R46sRFEal8zWx0wYvYyo6VDLJmpFzVNsyIOhglPV4bcUgXqUDLOWrOkZA",
                                                //    "sender": false,
                                                //    "money_transactions": [{
                                                //        "action": "Send",
                                                //        "code": "tBTC",
                                                //        "amount": 0.0001,
                                                //        "json": {
                                                //            "return_address": "2Mxufcnyzo8GvTGHqYfzS862ZqYaFYjxo5V",
                                                //            "address": "2NAXS7epN81nEH3XC37shuvH6uSjrdqvhNY"
                                                //        }
                                                //    }]
                                                //};

                                                if (old_session_info) {
                                                    if (JSON.stringify(old_session_info) != JSON.stringify(new_session_info)) {
                                                        readonly_keys = ['money_transactionid', 'sender','contact','money_transactions'] ;
                                                        null_keys = ['prvkey', 'userid2'] ;
                                                        errors = [] ;
                                                        for (i=0 ; i<readonly_keys.length ; i++) {
                                                            key = readonly_keys[i] ;
                                                            if (JSON.stringify(old_session_info[key]) != JSON.stringify(new_session_info[key])) {
                                                                errors.push(key + ': old value = ' + JSON.stringify(old_session_info[key]) + ', new value = ' + JSON.stringify(new_session_info[key])) ;
                                                            }
                                                        }
                                                        for (i=0 ; i<null_keys.length ; i++) {
                                                            key = null_keys[i] ;
                                                            if (!new_session_info.hasOwnProperty(key)) continue ; // using old private keys in step_2_get_pubkey and step_3_get_pubkey2
                                                            if (JSON.stringify(old_session_info[key]) != JSON.stringify(new_session_info[key])) {
                                                                errors.push(key + ' : old value = ' + JSON.stringify(old_session_info[key]) + ', new value = ' + JSON.stringify(new_session_info[key])) ;
                                                            }
                                                        }
                                                        if (errors.length) {
                                                            console.log(pgm + 'error. old and new session info are NOT identical') ;
                                                            console.log(pgm + 'old_session_info = ' + JSON.stringify(old_session_info)) ;
                                                            console.log(pgm + 'new_session_info = ' + JSON.stringify(new_session_info)) ;

                                                            errors.unshift('Inconsistency session information') ;
                                                            errors.unshift('Start money transaction failed') ;
                                                            console.log(pgm + 'error: ' + errors.join('. ')) ;
                                                            // notification in w3
                                                            z_wrapper_notification(['error', errors.join('<br>')]) ;
                                                            // notification in mn
                                                            group_debug_seq = MoneyNetworkAPILib.debug_group_operation_start() ;
                                                            pgm = service + '.process_incoming_message.' + request.msgtype + ' read_w_session callback 2/' + group_debug_seq + ': ';
                                                            console.log(pgm + 'Using group_debug_seq ' + group_debug_seq + ' for this send notification operation');
                                                            request2 = {
                                                                msgtype: 'notification',
                                                                type: 'error',
                                                                message: errors.join('<br>')
                                                            } ;
                                                            console.log(pgm + 'request2 = ' + JSON.stringify(request2)) ;
                                                            encrypt2.send_message(request2, {response: 30000, group_debug_seq: group_debug_seq}, function (response2) {
                                                                pgm = service + '.process_incoming_message.' + request.msgtype + ' send_message callback 3/' + group_debug_seq + ': ';
                                                                console.log(pgm + 'response2 = ' + JSON.stringify(response2)) ;
                                                            }) ;
                                                            return ;
                                                        }
                                                        // only minor differences. continue with start_mt processing
                                                        console.log(pgm + 'warning. minor differences between old and new session info') ;
                                                        console.log(pgm + 'old_session_info = ' + JSON.stringify(old_session_info)) ;
                                                        console.log(pgm + 'new_session_info = ' + JSON.stringify(new_session_info)) ;
                                                    }
                                                    if (!old_session_info.files) old_session_info.files = {} ;
                                                }
                                                session_info = old_session_info || new_session_info ;
                                                reason = request.msgtype ;

                                                // after approve incoming money transaction(s)
                                                // post start_mt tasks:
                                                // 1: warning if ZeroNet port is closed. optional files are not distributed. maybe use small normal files as a backup?
                                                // 2&3: generate public/private keys to be used in wallet-wallet communication
                                                // 4: create wallet-wallet session. expects incoming pubkeys message
                                                // 5: save pubkeys message for other wallet session
                                                // 6: save transaction in ls
                                                // 7: publish so that other MN and W3 sessions can see the new optional files

                                                // create callback chain step 1-8

                                                // start_mt step 8: publish
                                                step_8_publish = function () {
                                                    var pgm = service + '.process_incoming_message.' + request.msgtype + '.step_8_publish/' + group_debug_seq + ': ';
                                                    console.log(pgm + 'publish pubkeys message for other wallet session. publishing via MN publish queue. max one publish once every 30 seconds');
                                                    z_publish({publish: true, reason: reason, group_debug_seq: group_debug_seq});
                                                }; // step_8_publish

                                                // start_mt step 7. update session and money transaction(s) in ls
                                                step_7_save_in_ls = function () {
                                                    var pgm = service + '.process_incoming_message.' + request.msgtype + '.step_7_save_in_ls/' + group_debug_seq + ': ';
                                                    save_w_session(session_info, {group_debug_seq: group_debug_seq}, function () {
                                                        try {
                                                            console.log(pgm + 'OK. Updated wallet-wallet session information in localStorage');
                                                            step_8_publish();
                                                        }
                                                        catch (e) { return send_exception(pgm, e) }
                                                    });
                                                }; // step_7_save_in_ls

                                                // start_mt step 6. send pubkeys message for other wallet session
                                                step_6_send_pubkeys_msg = function () {
                                                    var pgm = service + '.process_incoming_message.' + request.msgtype + '.step_6_send_pubkeys_msg/' + group_debug_seq + ': ';
                                                    var request2, error, optional, options;
                                                    request2 = {
                                                        msgtype: 'w3_pubkeys',
                                                        pubkey: my_pubkey, // for JSEncrypt
                                                        pubkey2: my_pubkey2 // for cryptMessage
                                                    };
                                                    console.log(pgm + 'request2 = ' + JSON.stringify(request2));
                                                    options = {
                                                        encryptions: [3],
                                                        optional: session_info.ip_external ? 'o' : null,
                                                        subsystem: 'w3',
                                                        files: session_info.files,
                                                        status: '1: pubkeys sent, waiting for pubkeys',
                                                        group_debug_seq: group_debug_seq
                                                    } ;
                                                    try {
                                                        encrypt4.send_message(request2, options, function (response2, request_filename) {
                                                            var pgm, error ;
                                                            try {
                                                                pgm = service + '.process_incoming_message.' + request.msgtype + '.step_6_send_pubkeys_msg send_message callback/' + group_debug_seq + ': ';
                                                                if (!response2 || response2.error) {
                                                                    error = ['Money transaction post processing failed', 'pubkeys message was not send', 'error = ' + JSON.stringify(response2)];
                                                                    report_error(pgm, error, {group_debug_seq: group_debug_seq}) ;
                                                                    return;
                                                                }
                                                                console.log(pgm + 'response2        = ' + JSON.stringify(response2));
                                                                console.log(pgm + 'request_filename = ' + JSON.stringify(request_filename));
                                                                console.log(pgm + 'sent pubkeys message to other wallet session');
                                                                if (!ls.w_files) ls.w_files = {} ;
                                                                ls.w_files[request_filename] = true ;
                                                                reason = request_filename ;
                                                                // mark pubkeys message as sent. do not send two pubkeys messages to other wallet session
                                                                session_info.pubkeys_sent_at = new Date().getTime() ;
                                                                session_info.this_status = options.status ;
                                                                step_7_save_in_ls();
                                                            }
                                                            catch (e) { return send_exception(pgm, e) }
                                                        }); // send_message callback
                                                    }
                                                    catch (e) { return send_exception(pgm, e) }
                                                }; // step_6_send_pubkeys_msg

                                                // start_mt step 5. create wallet session. expects incoming pubkeys message from other wallet session
                                                step_5_create_session = function () {
                                                    var pgm = service + '.process_incoming_message.' + request.msgtype + '.step_5_create_session/' + group_debug_seq + ': ';

                                                    // create new session. demon process should read offline pubkeys message from other wallet session
                                                    encrypt4 = new MoneyNetworkAPI({
                                                        debug: 'encrypt4',
                                                        sessionid: session_info.money_transactionid,
                                                        sender: false,
                                                        prvkey: session_info.prvkey,
                                                        userid2: session_info.userid2,
                                                        cb: process_incoming_message
                                                    });
                                                    console.log(pgm + 'created wallet-wallet session. expects incoming pubkeys message from other wallet session in a few seconds');
                                                    // MoneyNetworkAPI.js:309 MoneyNetworkAPILib.add_session: monitoring other_session_filename e1af7946c6, sessionid = 3R1R46sRFEal8zWx0wYvYyo6VDLJmpFzVNsyIOhglPV4bcUgXqUDLOWrOkZA
                                                    // MoneyNetworkAPI.js:327 MoneyNetworkAPILib.add_session: other_session_filename e1af7946c6 should be processed by encrypt4
                                                    // MoneyNetworkAPI.js:1420 new MoneyNetworkAPI: encrypt4: Encryption setup: waiting for other_session_pubkey, other_session_pubkey2
                                                    step_6_send_pubkeys_msg();
                                                }; // step_5_create_session

                                                // start_mt step 4. save session and money transaction(s) in ls
                                                step_4_save_in_ls = function () {
                                                    var pgm = service + '.process_incoming_message.' + request.msgtype + '.step_6_save_in_ls/' + group_debug_seq + ': ';
                                                    save_w_session(session_info, {group_debug_seq: group_debug_seq}, function () {
                                                        try {
                                                            console.log(pgm + 'OK. Created wallet-wallet session information in localStorage');
                                                            step_5_create_session();
                                                        }
                                                        catch (e) { return send_exception(pgm, e) }
                                                    });
                                                }; // step_4_save_in_ls

                                                // start_mt step 3. generate public/private keys to be used in wallet to wallet communication. cryptMessage. encryption layer 2.
                                                step_3_get_pubkey2 = function () {
                                                    var pgm = service + '.process_incoming_message.' + request.msgtype + '.step_3_get_pubkey2/' + group_debug_seq + ': ';
                                                    var r, debug_seq;
                                                    if (!session_info.hasOwnProperty('userid2')) {
                                                        r = Math.random();
                                                        session_info.userid2 = parseInt(('' + r).substr(2, 3)); // 0-999
                                                        console.log(pgm + 'Generated new cryptMessage pubkey/prvkey set');
                                                    }
                                                    else console.log(pgm + 'Using old cryptMessage pubkey/prvkey set');
                                                    debug_seq = MoneyNetworkAPILib.debug_z_api_operation_start(pgm, null, 'userPublickey', null, group_debug_seq);
                                                    ZeroFrame.cmd("userPublickey", [session_info.userid2], function (pubkey2) {
                                                        try {
                                                            MoneyNetworkAPILib.debug_z_api_operation_end(debug_seq, pubkey2 ? 'OK' : 'Failed. Not found');
                                                            my_pubkey2 = pubkey2;
                                                            // console.log(pgm + 'session_info = ' + JSON.stringify(session_info));
                                                            step_4_save_in_ls();
                                                        }
                                                        catch (e) { return send_exception(pgm, e) }
                                                    }); // userPublickey
                                                }; // step_3_get_pubkey2

                                                // start_mt step 2. generate public/private keys to be used in wallet to wallet communication. JSEncrypt. encryption layer 1.
                                                step_2_get_pubkey = function () {
                                                    var pgm = service + '.process_incoming_message.' + request.msgtype + '.step_2_get_pubkey/' + group_debug_seq + ': ';
                                                    var crypt;
                                                    if (session_info.prvkey) {
                                                        // keep existing JSEncrypt keys
                                                        console.log(pgm + 'Using old JSEncrypt pubkey/prvkey set');
                                                        crypt = new JSEncrypt();
                                                        crypt.setPrivateKey(session_info.prvkey);
                                                    }
                                                    else {
                                                        // generate key JSEncrypt key set
                                                        console.log(pgm + 'Generated new JSEncrypt pubkey/prvkey set');
                                                        crypt = new JSEncrypt({default_key_size: 1024});
                                                        crypt.getKey();
                                                    }
                                                    my_pubkey = crypt.getPublicKey();
                                                    session_info.prvkey = crypt.getPrivateKey();
                                                    step_3_get_pubkey2();
                                                }; // step_2_get_pubkey

                                                // start_mt step 1. check if zeronet port is open. required for optional files distribution (money transactions)
                                                step_1_check_port = function () {
                                                    var pgm = service + '.process_incoming_message.' + request.msgtype + '.step_1_check_port/' + group_debug_seq + ': ';
                                                    check_port(pgm, session_info, group_debug_seq, send_exception, step_2_get_pubkey) ;
                                                }; // step_1_check_port

                                                // start callback chain
                                                step_1_check_port();
                                            }
                                            catch (e) { return send_exception(pgm, e) }
                                        }) ; // read_w_session callback 2
                                    }
                                    catch (e) { return send_exception(pgm, e) }
                                }); // send_response callback 1
                            }
                            catch (e) { return send_exception(pgm, e) }
                        })() ;
                        return;
                        // end start_mt
                    }
                    else if (request.msgtype == 'pubkeys') {
                        // error. pubkeys message from MN should be processes by read_pubkeys function (new session)
                        (function pubkeys() {
                            var pgm = service + '.process_incoming_message.' + request.msgtype + '/' + group_debug_seq + ': ';
                            console.log(pgm + 'Error. request = ' + JSON.stringify(request)) ;
                            console.log(pgm + 'pubkeys message from MN session should be processed by read_pubkeys function after new wallet session with new sessionid') ;
                            console.log(pgm + 'Please check log for errors in read_pubkeys function or wallet startup processing') ;
                            // do not send any response
                            response_timestamp = null ;
                        })() ;
                    }
                    else if (request.msgtype == 'request_wallet_backup') {
                        // backup/restore. MN is requesting a full localStorage copy.
                        // see permission section "Grant MoneyNetwork session permission to: backup X and restore X localStorage data. Confirm backup and restore: X
                        (function request_wallet_backup(){
                            var pgm = service + '.process_incoming_message.' + request.msgtype + '/' + group_debug_seq + ': ';
                            var filenames, user_path, step_1_confirm, step_2_read_content_json, step_3_send_backup_msg ;
                            console.log(pgm + 'request = ' + JSON.stringify(request)) ;

                            if (!status.permissions || !status.permissions.backup) return send_response('backup operation is not authorized');

                            // list with filenames to be included in backup. MN session will read and include files in backup file.
                            filenames = ['content.json'] ;

                            // callback chain:

                            // optional confirm backup. confirm box in W3. notification to MN. timeout in MN session is 60 seconds. confirm box 45 seconds
                            step_3_send_backup_msg = function () {
                                var pgm = service + '.process_incoming_message.' + request.msgtype + '.step_4_send_backup_msg/' + group_debug_seq + ': ';
                                response.msgtype = 'wallet_backup' ;
                                response.ls = JSON.stringify(ls) ;
                                if (filenames.length) response.filenames = filenames ;
                                response.auth_address = ZeroFrame.site_info.auth_address ;
                                response.cert_user_id = ZeroFrame.site_info.cert_user_id ;
                                console.log(pgm + 'response.filenames = ' + JSON.stringify(response.filenames)) ;
                                // response.filenames = ["content.json","f02116f927.1516784183846","wallet.json"]
                                send_response() ;
                            }; // step_2_backup

                            // get a list of files to be included in backup. MN session will read and add files to backup
                            step_2_read_content_json = function() {
                                var pgm = service + '.process_incoming_message.' + request.msgtype + '.step_2_read_content_json/' + group_debug_seq + ': ';
                                get_user_path(function (my_user_path) {
                                    user_path = my_user_path ;
                                    get_content_json(function (content) {
                                        var filename, re, m ;
                                        if (!content) send_response('System error. Could not find content.json file');
                                        for (filename in content.files) filenames.push(filename) ;
                                        re = new RegExp('^[0-9a-f]{10}(-i|-e|-o|-io|-p)\.[0-9]{13}$'); // pattern for MoneyNetworkAPI files.
                                        if (content.files_optional) for (filename in content.files_optional) {
                                            m=filename.match(re)  ;
                                            if (m && (['-i', '-e', '-p'].indexOf(m[1]) != -1)) continue ; // skip temporary MoneyNetworkAPI files
                                            filenames.push(filename) ;
                                        }
                                        step_3_send_backup_msg() ;
                                    })
                                }) ;

                            }; // step_2_read_content_json

                            // optional confirm backup request from MN. See "Confirm backup and restore" checkbox
                            step_1_confirm = function() {
                                var pgm = service + '.process_incoming_message.' + request.msgtype + '.step_1_confirm/' + group_debug_seq + ': ';
                                var confirm_status, confirm_timeout_fnk, message ;
                                if (!status.permissions.confirm_backup_restore) return step_2_read_content_json() ;

                                // user must confirm backup request in W3
                                confirm_status = {done: false};
                                confirm_timeout_fnk = function () {
                                    if (confirm_status.done) return; // confirm dialog done
                                    confirm_status.done = true;
                                    send_response('Confirm backup timeout');
                                };
                                setTimeout(confirm_timeout_fnk, 45000);

                                // 1: confirm dialog in W3
                                message = 'MN backup request<br>Send full W3 backup to MN?' ;
                                ZeroFrame.cmd("wrapperConfirm", [message, 'OK'], function (confirm) {
                                    if (confirm_status.done) return; // confirm dialog done (OK or timeout)
                                    confirm_status.done = true ;
                                    if (!confirm) return send_response('backup request was rejected');
                                    // backup request was confirmed. continue
                                    step_2_read_content_json();
                                }) ;

                                // 2: notification in MN session.
                                report_error(pgm, 'Please confirm backup request in W3', {log: false, w3: false, type:'info', timeout: 10000}) ;

                            }; // step_1_confirm

                            step_1_confirm() ;

                        })() ;
                        // response is handled in request_wallet_backup block
                        return ;

                    }

                    else if (request.msgtype == 'restore_wallet_backup') {
                        // backup/restore. MN is requesting a full localStorage copy.
                        // see permission section "Grant MoneyNetwork session permission to: backup X and restore X localStorage data. Confirm backup and restore: X
                        (function restore_wallet_backup() {
                            var pgm = service + '.process_incoming_message.' + request.msgtype + '/' + group_debug_seq + ': ';
                            var restore_ls, restore_files, step_1_confirm, step_2_send_ok_response, step_3_notification,
                                step_4_delete_user_files,  step_5_clear_cache, step_6_restore_files, step_7_restore_ls,
                                step_8_restart_w3_session, user_path;

                            // console.log(pgm + 'request = ' + JSON.stringify(request)) ;

                            // validate request. ls must be a JSON.stringify strings
                            try {
                                restore_ls = JSON.parse(request.ls) ;
                            }
                            catch (e) {
                                return send_response('invalid restore_wallet_backup request. request.ls is not a JSON.stringify string') ;
                            }
                            restore_files = request.files ;

                            // check permissions
                            if (!status.permissions || !status.permissions.restore) return send_response('restore operation is not authorized');


                            // callback chain: step 1-8

                            // restore wallet backup step 8
                            step_8_restart_w3_session = function (group_debug_seq) {
                                var pgm, job ;
                                try {
                                    pgm = service + '.process_incoming_message.' + request.msgtype + '.step_8_restart_w3_session/' + group_debug_seq + ': ';
                                    MoneyNetworkAPILib.debug_group_operation_end(group_debug_seq);

                                    z_wrapper_notification(['done', 'W3 wallet was restored. Reloading page in 3 seconds']) ;

                                    job = function() {
                                        $window.location.reload()
                                    } ;
                                    $timeout(job, 3000) ;
                                }
                                catch (e) {
                                    if (!e) return ; // exception in MoneyNetworkAPI instance
                                    if (!pgm) pgm = 'restore_wallet_backup/step_8_restart_w2_session' ;
                                    error = e.message ? e.message : e ;
                                    console.log(pgm + error);
                                    if (e.stack) console.log(e.stack);
                                    report_error(pgm, ['Restore backup failed', "JS exception", error], {log: false, group_debug_seq: group_debug_seq}) ;
                                    throw(e);
                                }
                            } ; // step_8_restart_w3_session

                            // restore wallet backup step 7
                            step_7_restore_ls = function (group_debug_seq) {
                                var pgm ;
                                try {
                                    pgm = service + '.process_incoming_message.' + request.msgtype + '.step_7_restore_ls/' + group_debug_seq + ': ';
                                    // todo: should sign and publish content.json after page reload!!!

                                    // mark localStorage as restored. notification after W3 page reload
                                    restore_ls.wallet_backup_restored = {
                                        now: new Date().getTime(),
                                        timestamp: request.timestamp,
                                        filename: request.filename
                                    } ;

                                    ZeroFrame.cmd("wrapperSetLocalStorage", [restore_ls], function () {}) ;

                                    step_8_restart_w3_session(group_debug_seq) ;
                                }
                                catch (e) {
                                    if (!e) return ; // exception in MoneyNetworkAPI instance
                                    if (!pgm) pgm = 'restore_wallet_backup/step_7_restore_ls' ;
                                    error = e.message ? e.message : e ;
                                    console.log(pgm + error);
                                    if (e.stack) console.log(e.stack);
                                    report_error(pgm, ['Restore backup failed', "JS exception", error], {log: false, group_debug_seq: group_debug_seq}) ;
                                    throw(e);
                                }
                            } ; // step_7_restore_ls

                            // restore wallet backup step 6
                            step_6_restore_files = function (group_debug_seq) {
                                var pgm, row, image_base64uri, post_data, json_raw ;
                                try {
                                    pgm = service + '.process_incoming_message.' + request.msgtype + '.step_6_restore_files/' + group_debug_seq + ': ';
                                    if (!restore_files || !restore_files.length) return step_7_restore_ls(group_debug_seq) ;
                                    row = restore_files.shift() ;
                                    console.log(pgm + 'restoring ' + row.filename) ;
                                    inner_path = user_path + row.filename ;
                                    if (row.filename.match(/\.json/)) {
                                        // json file
                                        json_raw = unescape(encodeURIComponent(row.content));
                                        post_data = btoa(json_raw);
                                    }
                                    else {
                                        // not json. assuming image
                                        image_base64uri = row.content;
                                        post_data = image_base64uri != null ? image_base64uri.replace(/.*?,/, "") : void 0;
                                    }
                                    z_file_write(pgm, inner_path, post_data, {group_debug_seq: group_debug_seq}, function (res) {
                                        var pgm ;
                                        try {
                                            pgm = service + '.process_incoming_message.' + request.msgtype + '.step_6_restore_files z_file_write callback 1/' + group_debug_seq + ': ';
                                            if (!res || (res != 'ok')) console.log(pgm + 'fileWrite failed for ' + filename + '. error = ' + JSON.stringify(res)) ;
                                            step_6_restore_files() ;
                                        }
                                        catch (e) {
                                            if (!e) return ; // exception in MoneyNetworkAPI instance
                                            if (!pgm) pgm = 'restore_wallet_backup/step_6_restore_files 1' ;
                                            error = e.message ? e.message : e ;
                                            console.log(pgm + error);
                                            if (e.stack) console.log(e.stack);
                                            report_error(pgm, ['Restore backup failed', "JS exception", error], {log: false, group_debug_seq: group_debug_seq}) ;
                                            throw(e);
                                        }
                                    }) ; // z_file_write callback 1
                                }
                                catch (e) {
                                    if (!e) return ; // exception in MoneyNetworkAPI instance
                                    if (!pgm) pgm = 'restore_wallet_backup/step_6_restore_files 0' ;
                                    error = e.message ? e.message : e ;
                                    console.log(pgm + error);
                                    if (e.stack) console.log(e.stack);
                                    report_error(pgm, ['Restore backup failed', "JS exception", error], {log: false, group_debug_seq: group_debug_seq}) ;
                                    throw(e);
                                }
                            } ; // step_6_restore_files

                            // restore wallet backup step 5 - clear cache
                            step_5_clear_cache = function (group_debug_seq) {
                                var pgm  ;
                                try {
                                    pgm = service + '.process_incoming_message.' + request.msgtype + '.step_5_clear_cache/' + group_debug_seq + ': ';

                                    // clear cache and continue with restore
                                    MoneyNetworkAPILib.clear_all_data() ;
                                    MoneyNetworkAPILib.config({
                                        debug: true, ZeroFrame: ZeroFrame, optional: Z_CONTENT_OPTIONAL,
                                        cb: process_incoming_message, cb_fileget: true, cb_decrypt: true,
                                        waiting_for_file_publish: waiting_for_file_publish}) ;
                                    delete z_cache.content_json ;
                                    delete z_cache.wallet_json ;

                                    MoneyNetworkAPILib.get_all_hubs(true, function () {
                                        var pgm, filenames, i ;
                                        try {
                                            group_debug_seq = MoneyNetworkAPILib.debug_group_operation_start();
                                            pgm = service + '.process_incoming_message.' + request.msgtype + '.step_5_clear_cache get_all_hubs callback/' + group_debug_seq + ': ';
                                            console.log(pgm + 'Using group_debug_seq ' + group_debug_seq + ' for this post restore_wallet_backup processing operation');

                                            filenames = [] ;
                                            if (restore_files && restore_files.length) for (i=0 ; i<restore_files.length ; i++) filenames.push(restore_files[i].filename) ;
                                            console.log(pgm + 'restoring ' + filenames.join(', ')) ;
                                            step_6_restore_files(group_debug_seq) ;
                                        }
                                        catch (e) {
                                            if (!e) return ; // exception in MoneyNetworkAPI instance
                                            if (!pgm) pgm = 'restore_wallet_backup/step_5_clear_cache 1' ;
                                            error = e.message ? e.message : e ;
                                            console.log(pgm + error);
                                            if (e.stack) console.log(e.stack);
                                            report_error(pgm, ['Restore backup failed', "JS exception", error], {log: false, group_debug_seq: group_debug_seq}) ;
                                            throw(e);
                                        }
                                    }) ; // get_all_hubs callback 1
                                }
                                catch (e) {
                                    if (!e) return ; // exception in MoneyNetworkAPI instance
                                    if (!pgm) pgm = 'restore_wallet_backup/step_5_clear_cache 0' ;
                                    error = e.message ? e.message : e ;
                                    console.log(pgm + error);
                                    if (e.stack) console.log(e.stack);
                                    report_error(pgm, ['Restore backup failed', "JS exception", error], {log: false, group_debug_seq: group_debug_seq}) ;
                                    throw(e);
                                }
                            } ; // step_5_clear_cache


                            // restore wallet backup step 4
                            step_4_delete_user_files = function (group_debug_seq) {
                                var pgm ;
                                try {
                                    pgm = service + '.process_incoming_message.' + request.msgtype + '.step_4_delete_user_files/' + group_debug_seq + ': ';
                                    z_wrapper_notification(['info', 'W3 wallet restored started. Please wait', 10000]) ;

                                    get_content_json(function (content) {
                                        var pgm, delete_files, filename, delete_file ;
                                        try {
                                            pgm = service + '.process_incoming_message.' + request.msgtype + '.step_4_delete_user_files get_content_json callback 1/' + group_debug_seq + ': ';
                                            if (!content) {
                                                console.log(pgm + 'error. content.json file has not found. continue with restore of files from backup') ;
                                                return step_5_clear_cache(group_debug_seq) ;
                                            }
                                            delete_files = [] ;
                                            for (filename in content.files) delete_files.push(filename) ;
                                            if (content.files_optional) for (filename in content.files_optional) delete_files.push(filename) ;

                                            // delete file loop
                                            delete_file = function() {
                                                var filename ;
                                                filename = delete_files.shift() ;
                                                if (!filename) return step_5_clear_cache(group_debug_seq) ; // done. continue to restore
                                                inner_path = user_path + filename ;
                                                MoneyNetworkAPILib.z_file_delete(pgm, inner_path, function (res) {
                                                    var pgm ;
                                                    try {
                                                        pgm = service + '.process_incoming_message.' + request.msgtype + '.step_4_delete_user_files z_file_delete callback 3/' + group_debug_seq + ': ';
                                                        if (!res || (res != 'ok')) console.log(pgm + 'fileDelete failed for ' + filename + '. error = ' + JSON.stringify(res)) ;
                                                        delete_file() ;
                                                    }
                                                    catch (e) {
                                                        if (!e) return ; // exception in MoneyNetworkAPI instance
                                                        if (!pgm) pgm = 'restore_wallet_backup/step_4_delete_user_files 2' ;
                                                        error = e.message ? e.message : e ;
                                                        console.log(pgm + error);
                                                        if (e.stack) console.log(e.stack);
                                                        report_error(pgm, ['Restore backup failed', "JS exception", error], {log: false, group_debug_seq: group_debug_seq}) ;
                                                        throw(e);
                                                    }
                                                }); // z_file_delete callback 3
                                            } ; // delete_file 2
                                            delete_file() ;
                                        }
                                        catch (e) {
                                            if (!e) return ; // exception in MoneyNetworkAPI instance
                                            if (!pgm) pgm = 'restore_wallet_backup/step_4_delete_user_files 1' ;
                                            error = e.message ? e.message : e ;
                                            console.log(pgm + error);
                                            if (e.stack) console.log(e.stack);
                                            report_error(pgm, ['Restore backup failed', "JS exception", error], {log: false, group_debug_seq: group_debug_seq}) ;
                                            throw(e);
                                        }
                                    }) ; // get_content_json callback 1
                                }
                                catch (e) {
                                    if (!e) return ; // exception in MoneyNetworkAPI instance
                                    if (!pgm) pgm = 'restore_wallet_backup/step_4_delete_user_files 0' ;
                                    error = e.message ? e.message : e ;
                                    console.log(pgm + error);
                                    if (e.stack) console.log(e.stack);
                                    report_error(pgm, ['Restore backup failed', "JS exception", error], {log: false, group_debug_seq: group_debug_seq}) ;
                                    throw(e);
                                }
                            } ; // step_4_delete_user_files

                            // restore wallet backup step 3
                            // notification before restore. restore starts in 10 seconds. should allow MN to read OK response sent in step_2_send_ok_response
                            step_3_notification = function (group_debug_seq) {
                                var pgm, job ;
                                try {
                                    pgm = service + '.process_incoming_message.' + request.msgtype + '.step_3_notification/' + group_debug_seq + ': ';
                                    z_wrapper_notification(['info', 'W3 wallet restore starts in 10 seconds. Please wait', 10000]) ;
                                    // wait 10 seconds and start restore
                                    job = function () { step_4_delete_user_files(group_debug_seq)} ;
                                    $timeout(job, 10000) ;

                                    // stop all running operations doing restore
                                    status.restoring = true ;
                                }
                                catch (e) {
                                    if (!e) return ; // exception in MoneyNetworkAPI instance
                                    if (!pgm) pgm = 'restore_wallet_backup/step_3_notification' ;
                                    error = e.message ? e.message : e ;
                                    console.log(pgm + error);
                                    if (e.stack) console.log(e.stack);
                                    report_error(pgm, ['Restore backup failed', "JS exception", error], {log: false, group_debug_seq: group_debug_seq}) ;
                                    throw(e);
                                }
                            } ; // step_3_notification

                            // restore wallet backup step 2
                            // optional confirm restore. confirm box in W3. notification to MN. timeout in MN session is 60 seconds. confirm box 45 seconds
                            step_2_send_ok_response = function () {
                                // send OK response to MN session, wait a few seconds to allow MN to read OK response and start restore process
                                send_response(null, function () {
                                    var pgm, group_debug_seq ;
                                    try {
                                        // OK restore_wallet_backup response was sent to mn. get a new group debug seq for this start_mt post processing.
                                        group_debug_seq = MoneyNetworkAPILib.debug_group_operation_start();
                                        pgm = service + '.process_incoming_message.' + request.msgtype + '.step_2_send_ok_response/' + group_debug_seq + ': ';
                                        console.log(pgm + 'OK start_mt response was send to MN. continue with restore_wallet_backup post processing');
                                        console.log(pgm + 'Using group_debug_seq ' + group_debug_seq + ' for this post restore_wallet_backup processing operation');

                                        console.log(pgm + 'todo: 1) wait a few seconds before starting restore. MN session will wait max 60 seconds for restore_wallet_backup OK response') ;
                                        console.log(pgm + 'todo: 2) display notification in W3') ;
                                        console.log(pgm + 'todo: 3) display spinner with countdown in W3') ;
                                        console.log(pgm + 'todo: 4) delete all old zeronet files') ;
                                        console.log(pgm + 'todo: 5) write new wallet.json') ;
                                        console.log(pgm + 'todo: 6) sign and optional publish new wallet.json') ;
                                        console.log(pgm + 'todo: 7) best with a publish after new MN-W3 session handshake') ;
                                        console.log(pgm + 'todo: 8) restore localStorage') ;
                                        console.log(pgm + 'todo: 9) angularJS reload session data / page reload or ?');

                                        get_user_path(function (path) {
                                            try {
                                                user_path = path ;
                                                step_3_notification(group_debug_seq) ;
                                            }
                                            catch (e) {
                                                if (!e) return ; // exception in MoneyNetworkAPI instance
                                                if (!pgm) pgm = 'restore_wallet_backup/send_response 2' ;
                                                error = e.message ? e.message : e ;
                                                console.log(pgm + error);
                                                if (e.stack) console.log(e.stack);
                                                report_error(pgm, ['Restore backup failed', "JS exception", error], {log: false, group_debug_seq: group_debug_seq}) ;
                                                throw(e);
                                            }
                                        }) ; // get_user_path callback 2
                                    }
                                    catch (e) {
                                        if (!e) return ; // exception in MoneyNetworkAPI instance
                                        if (!pgm) pgm = 'restore_wallet_backup/send_response 1' ;
                                        error = e.message ? e.message : e ;
                                        console.log(pgm + error);
                                        if (e.stack) console.log(e.stack);
                                        report_error(pgm, ['Restore backup failed', "JS exception", error], {log: false, group_debug_seq: group_debug_seq}) ;
                                        throw(e);
                                    }
                                }) ; // send_response callback 1
                            }; // step_2_send_ok_response

                            // restore wallet backup step 1
                            // optional confirm restore. See "Confirm backup and restore" checkbox
                            step_1_confirm = function() {
                                var pgm, confirm_status, confirm_timeout_fnk, message ;
                                try {
                                    pgm = service + '.process_incoming_message.' + request.msgtype + '.step_1_confirm/' + group_debug_seq + ': ';
                                    if (!status.permissions.confirm_backup_restore) return step_2_send_ok_response() ;

                                    // user must confirm backup request in W3
                                    confirm_status = {done: false};
                                    confirm_timeout_fnk = function () {
                                        if (confirm_status.done) return; // confirm dialog done
                                        confirm_status.done = true;
                                        send_response('Confirm backup timeout')
                                    };
                                    setTimeout(confirm_timeout_fnk, 45000);

                                    // 1: confirm dialog in W3
                                    // todo: add restore info: timestamp, filename, size etc
                                    message = 'MN restore request. Allow full W3 localStorage restore.<br>All existing data will be deleted. No way back' ;
                                    ZeroFrame.cmd("wrapperConfirm", [message, 'OK'], function (confirm) {
                                        try {
                                            if (confirm_status.done) return; // confirm dialog done (OK or timeout)
                                            confirm_status.done = true ;
                                            if (!confirm) return send_response('backup request was rejected');
                                            // restore request was confirmed. continue
                                            step_2_send_ok_response();
                                        }
                                        catch (e) { return send_exception(pgm, e) }
                                    }) ; // wrapperConfirm callback

                                    // 2: notification in MN session.
                                    report_error(pgm, 'Please confirm backup restore in W3', {log: false, w3: false, type:'info', timeout: 10000}) ;
                                }
                                catch (e) { return send_exception(pgm, e) }
                            }; // step_1_confirm

                            step_1_confirm() ;

                        })() ;
                        // response is handled in restore_wallet_backup block
                        return ;
                    }

                    else if (request.msgtype == 'w3_pubkeys') {
                        // w3_pubkeys message handshake between wallet sessions.
                        (function w3_pubkeys(){
                            var pgm = service + '.process_incoming_message.' + request.msgtype + '/' + group_debug_seq + ': ';
                            var auth_address, sha256, encrypted_session_info, error;
                            try {
                                // load session from ls
                                read_w_session(encrypt2.sessionid, {group_debug_seq: group_debug_seq, ip_external: true}, function (session_info) {
                                    var pgm = service + '.process_incoming_message.' + request.msgtype + ' read_w_session callback 1/' + group_debug_seq + ': ';
                                    var request2, i, money_transaction, ls_updated, options ;

                                    try {
                                        if (!session_info) {
                                            error = ['Wallet session handshake failed', 'Money transaction was aborted', 'Unknown sessionid ' + encrypt2.sessionid];
                                            console.log(pgm + 'error. ' + error.join('. '));
                                            z_wrapper_notification(['error', error.join('<br>')]);
                                            // todo: send notification to mn using global encrypt2 object
                                            return; // no error response. this is a offline message
                                        }

                                        // validations:
                                        // - request.pubkey == session_info.pubkey (encryption layer 1)
                                        // - request.pubkey2 == session_info.pubkey2 (layer 2)
                                        // - encrypt2.sessionid == session_info.money_transactionid (layer 3)

                                        // encryption layer 1 (JSEncrypt)
                                        if (!session_info.pubkey) {
                                            session_info.pubkey = request.pubkey;
                                            encrypt2.setup_encryption({pubkey: request.pubkey});
                                            ls_updated = true ;
                                        }
                                        else if (request.pubkey != session_info.pubkey) {
                                            console.log(pgm + 'warning. received a new changed pubkey from other wallet session (JSEncrypt)');
                                            console.log(pgm + 'old pubkey = ' + session_info.pubkey);
                                            console.log(pgm + 'new pubkey = ' + request.pubkey);
                                            report_error(pgm, ['warning', 'received a changed pubkey'], {group_debug_seq: group_debug_seq, end_group_operation: false, type: 'info'});
                                        }
                                        // layer 2
                                        if (!session_info.pubkey2) {
                                            session_info.pubkey2 = request.pubkey2;
                                            encrypt2.setup_encryption({pubkey2: request.pubkey2});
                                            ls_updated = true ;
                                        }
                                        else if (request.pubkey2 != session_info.pubkey2) {
                                            console.log(pgm + 'warning. received a new changed pubkey2 from other wallet session (cryptMessage)');
                                            console.log(pgm + 'old pubkey2 = ' + session_info.pubkey2);
                                            console.log(pgm + 'new pubkey2 = ' + request.pubkey2);
                                            report_error(pgm, ['warning', 'received a changed pubkey2'], {group_debug_seq: group_debug_seq, end_group_operation: false, type: 'info'});
                                        }
                                        // layer 3
                                        if (encrypt2.sessionid != session_info.money_transactionid) {
                                            console.log(pgm + 'warning. encrypt2.sessionid <> money_transactionid');
                                            report_error(pgm, ['error', 'encrypt2.sessionid <> money_transactionid'], {group_debug_seq: group_debug_seq, end_group_operation: false, type: 'error'});
                                            console.log(pgm + 'encrypt2.sessionid = ' + encrypt2.sessionid);
                                            console.log(pgm + 'session_info.money_transactionid = ' + session_info.money_transactionid);
                                        }

                                        // ready for transaction verification. both wallet sessions should have identical money transaction(s)
                                        console.log(pgm + 'session_info.money_transactions = ' + JSON.stringify(session_info.money_transactions));
                                        console.log(pgm + 'sender/receiver check. sender = ' + encrypt2.sender + ', receiver = ' + encrypt2.receiver);

                                        // sender=sweden, receiver=torando
                                        // sweden would like to send money to torando and is asking torando for approval and a ether address
                                        // torando has received money transaction, approved transaction and added a address.
                                        // sweden has not yet received address from torando.
                                        // otherwise the transaction is identical in sweden and torando wallets
                                        // generic sender: only one ether address. either address or return_address
                                        // generic receiver: always two ether addreses. both address and return_address.
                                        // receiver must return ether addresses to sender.
                                        //
                                        // sender_sweden = [{
                                        //    "action": "Send",
                                        //    "code": "tBTC",
                                        //    "amount": 0.0001,
                                        //    "json": {"return_address": "2NG8wLQf5uYiGn8RX4NYPz6HRssenNvVdSj"}
                                        //}];
                                        // receiver_torando = [{
                                        //    "action": "Send",
                                        //    "code": "tBTC",
                                        //    "amount": 0.0001,
                                        //    "json": {
                                        //        "return_address": "2NG8wLQf5uYiGn8RX4NYPz6HRssenNvVdSj",
                                        //        "address": "2MznAqaYAd4ZKXbrLcyRwfUm1HezaPBUXsU"
                                        //    }
                                        //}];
                                        if (ls_updated) console.log(pgm + 'session_info = ' + JSON.stringify(session_info)) ;

                                        if (encrypt2.sender) {
                                            // stop. is sender of money transaction(s).
                                            // wait for receiver of money transaction(s) to send w3_check_mt message with missing ether address
                                            console.log(pgm + 'pubkeys message ok. wallet-wallet communication started. is sender of money transaction. waiting for w3_check_mt message from other wallet to crosscheck money transaction(s) before sending money transaction(s) to ropsten (the test network)');
                                            if (ls_updated) {
                                                save_w_session(session_info, {group_debug_seq: group_debug_seq}, function() {
                                                    MoneyNetworkAPILib.debug_group_operation_end(group_debug_seq) ;
                                                }) ;
                                            }
                                            else MoneyNetworkAPILib.debug_group_operation_end(group_debug_seq) ;
                                            return;
                                        }
                                        if (session_info.w3_check_mt_sent_at) {
                                            // ignore. w3_check_mt message has already been sent to other wallet session
                                            if (ls_updated) {
                                                save_w_session(session_info, {group_debug_seq: group_debug_seq}, function() {
                                                    MoneyNetworkAPILib.debug_group_operation_end(group_debug_seq) ;
                                                }) ;
                                            }
                                            else MoneyNetworkAPILib.debug_group_operation_end(group_debug_seq) ;
                                            return ;
                                        }
                                        console.log(pgm + 'pubkeys message ok. wallet-wallet communication started. is client/receiver. sending w3_check_mt message to other wallet to crosscheck money transaction(s) before sending money transaction(s) to ropsten (the test network)');

                                        // is receiver. have both address and return_address for money transaction(s).
                                        // send ether address(es) added in check_mt to sender of money transaction
                                        // w3_check_mt message is being used for money transaction crosscheck
                                        // the two wallets must agree about money transaction(s) to start
                                        request2 = {
                                            msgtype: 'w3_check_mt',
                                            money_transactions: []
                                        };
                                        for (i = 0; i < session_info.money_transactions.length; i++) {
                                            money_transaction = session_info.money_transactions[i];
                                            request2.money_transactions.push({
                                                action: money_transaction.action,
                                                code: money_transaction.code,
                                                amount: money_transaction.amount,
                                                json: {
                                                    address: money_transaction.json.address,
                                                    return_address: money_transaction.json.return_address
                                                }
                                            });
                                        }
                                        console.log(pgm + 'request2 = ' + JSON.stringify(request2));
                                        //request2 = {
                                        //    "msgtype": "addresses",
                                        //    "jsons": [{"address": "2MwdBoKJGVto96ptKRaPbUG6hmpjwuGUCa4"}]
                                        //};
                                        // send w3_check_mt as an offline message to other wallet session
                                        if (!session_info.files) session_info.files = {} ;
                                        options = {
                                            optional: session_info.ip_external ? 'o' : null,
                                            subsystem: 'w3',
                                            files: session_info.files,
                                            status: '2: w3_check_mt sent, waiting for w3_start_mt',
                                            group_debug_seq: group_debug_seq
                                        } ;
                                        encrypt2.send_message(request2, options, function (response2, request_filename) {
                                            var pgm = service + '.process_incoming_message.' + request.msgtype + ' send_message callback 2/' + group_debug_seq + ': ';
                                            var error;
                                            try {
                                                if (!response2 || response2.error) {
                                                    error = ['Money transaction post processing failed', 'w3_check_mt message was not send', 'error = ' + JSON.stringify(response2)];
                                                    report_error(pgm, error, {group_debug_seq: group_debug_seq}) ;
                                                    return;
                                                }
                                                console.log(pgm + 'response2        = ' + JSON.stringify(response2));
                                                console.log(pgm + 'request_filename = ' + JSON.stringify(request_filename));
                                                if (!ls.w_files) ls.w_files = {} ;
                                                ls.w_files[request_filename] = true ;
                                                // mark as sent. do not sent w3_check_mt message again
                                                session_info.w3_check_mt_sent_at = new Date().getTime() ;
                                                session_info.this_status = options.status ;
                                                save_w_session(session_info, {group_debug_seq: group_debug_seq}, function () {
                                                    var pgm = service + '.process_incoming_message.' + request.msgtype + ' save_w_session callback 3/' + group_debug_seq + ': ';
                                                    try { z_publish({publish: true, reason: request_filename});}
                                                    catch (e) {
                                                        // receive offline message pubkeys failed.
                                                        if (!e) return ; // exception in MoneyNetworkAPI instance
                                                        console.log(pgm + e.message);
                                                        console.log(e.stack);
                                                        report_error(pgm, ["JS exception", e.message], {log: false, group_debug_seq: group_debug_seq}) ;
                                                        throw(e);
                                                    }
                                                });
                                            }
                                            catch (e) {
                                                // receive offline message pubkeys failed.
                                                if (!e) return ; // exception in MoneyNetworkAPI instance
                                                console.log(pgm + e.message);
                                                console.log(e.stack);
                                                report_error(pgm, ["JS exception", e.message], {log: false, group_debug_seq: group_debug_seq}) ;
                                                throw(e);
                                            }
                                        }); // send_message callback 2
                                    }
                                    catch (e) {
                                        // receive offline message pubkeys failed.
                                        if (!e) return ; // exception in MoneyNetworkAPI instance
                                        console.log(pgm + e.message);
                                        console.log(e.stack);
                                        report_error(pgm, ["JS exception", e.message], {log: false, group_debug_seq: group_debug_seq}) ;
                                        throw(e);
                                    }
                                }) ; // read_w_session callback 1
                            }
                            catch (e) {
                                // receive offline message pubkeys failed.
                                if (!e) return ; // exception in MoneyNetworkAPI instance
                                console.log(pgm + e.message);
                                console.log(e.stack);
                                report_error(pgm, ["JS exception", e.message], {log: false, group_debug_seq: group_debug_seq}) ;
                                throw(e);
                            }
                        })() ;
                        return; // no response to offline pubkeys message
                        // w3_pubkeys
                    }
                    else if (request.msgtype == 'w3_check_mt') {
                        // after pubkeys session handshake. Now running full encryption
                        // receiver to sender:
                        // - returning missing ether address (address or return_address) to money transaction sender
                        //
                        (function w3_check_mt(){
                            var pgm = service + '.process_incoming_message.' + request.msgtype + '/' + group_debug_seq + ': ';
                            var auth_address, sha256, encrypted_session_info;
                            try {
                                // check ls status
                                if (!ls.w_sessions) ls.w_sessions = {};
                                auth_address = ZeroFrame.site_info.auth_address;
                                if (!ls.w_sessions[auth_address]) ls.w_sessions[auth_address] = {};
                                sha256 = CryptoJS.SHA256(encrypt2.sessionid).toString();
                                encrypted_session_info = ls.w_sessions[auth_address][sha256];
                                if (!encrypted_session_info) {
                                    error = ['Money transaction cannot start', 'w3_check_mt message with unknown sessionid', encrypt2.sessionid];
                                    report_error(pgm, error) ;
                                    return; // no error response. this is a offline message
                                }

                                // load session info from ls
                                read_w_session(encrypt2.sessionid, {group_debug_seq: group_debug_seq, ip_external: true}, function (session_info) {
                                    var pgm = service + '.process_incoming_message.' + request.msgtype + ' read_w_session callback 1/' + group_debug_seq + ': ';
                                    var error, i, my_money_transaction, contact_money_transaction, send_w3_start_mt, delete_pubkeys_msg;
                                    try {
                                        console.log(pgm + 'session_info = ' + JSON.stringify(session_info));

                                        // 1) must be sender
                                        if (!session_info.sender) {
                                            console.log(pgm + 'warning. is receiver of money transaction. ignoring incoming w3_check_mt message. w3_check_mt message is only sent from receiver of money transaction to sender of money transaction');
                                            return;
                                        }
                                        // i am sender of money transaction to contact

                                        if (session_info.w3_start_mt_sent_at) {
                                            console.log(pgm + 'stopping. w3_start_mt message has already been sent to other session. w3_start_mt_sent_at = ' + session_info.w3_start_mt_sent_at) ;
                                            return ;
                                        }

                                        // has pubkeys from other wallet been received from other wallet? cannot encrypt w3_start_mt without public keys from other wallet session
                                        if (!encrypt2.other_session_pubkey || !encrypt2.other_session_pubkey2) {
                                            console.log(pgm + 'waiting for pubkeys message from other wallet session. cannot encrypt send w3_start_mt message without public keys') ;
                                            wait_for_pubkeys_message({
                                                encrypt2: encrypt2,
                                                session_info: session_info,
                                                in_filename: filename,
                                                in_msg_name:'w3_check_mt',
                                                out_msg_name: 'w3_start_mt',
                                                group_debug_seq: group_debug_seq
                                            }) ;
                                            return ;
                                        }

                                        // cleanup old outgoing files:
                                        // - is "sender"
                                        // - is receiving w3_check_mt message from "receiver"
                                        // - "receiver" must have received 'w3_pubkeys' message from "sender"
                                        // - find and delete old pubkeys message from sender to receiver
                                        delete_pubkeys_msg = function (cb) {
                                            delete_old_msg({session_info: session_info, msg_name: 'w3_pubkeys', encrypt: encrypt2, group_debug_seq: group_debug_seq}, cb) ;
                                        } ; // delete_pubkeys_msg

                                        delete_pubkeys_msg(function() {
                                            var send_w3_start_mt ;
                                            try {
                                                send_w3_start_mt = function (error, cb) {
                                                    var pgm = service + '.process_incoming_message.' + request.msgtype + '.send_w3_start_mt/' + group_debug_seq + ': ';
                                                    var request2, money_transaction, is_null, options;
                                                    if (error && (typeof error != 'string')) {
                                                        console.log(pgm + 'invalid send_w3_start_mt call. First parameter error must be null or a string') ;
                                                        throw pgm + 'invalid send_w3_start_mt call. First parameter error must be null or a string';
                                                    }
                                                    if (!cb) cb = function () {};
                                                    if (typeof cb != 'function') {
                                                        console.log(pgm + 'invalid send_w3_start_mt call. second parameter cb must be null or a callback function') ;
                                                        throw pgm + 'invalid send_w3_start_mt call. second parameter cb must be null or a callback function';
                                                    }
                                                    request2 = {
                                                        msgtype: 'w3_start_mt',
                                                        pay_results: []
                                                    };
                                                    for (i=0 ; i<session_info.money_transactions.length ; i++) {
                                                        money_transaction = session_info.money_transactions[i] ;
                                                        request2.pay_results.push(money_transaction.ether_send_ok || money_transaction.ether_send_error) ;
                                                        if (request2.pay_results[request2.pay_results.length-1]) is_null = false ;
                                                    } // for i
                                                    if (error && is_null) delete request2.pay_results ;
                                                    if (error) request2.error = error;
                                                    //request2 = {
                                                    //    "msgtype": "w3_start_mt",
                                                    //    "pay_results": ["3b49bae7e2b69f17f35c849f7148cd5c4573dc4ec0a25c3d539eca695cee9061", null]
                                                    //};
                                                    if (!session_info.files) session_info.files = {} ;
                                                    options = {
                                                        optional: session_info.ip_external ? 'o' : null, // use offline optional file (-o) or normal file
                                                        subsystem: 'w3',
                                                        files: session_info.files,
                                                        status: '3: w3_start_mt sent, waiting for w3_end_mt',
                                                        group_debug_seq: group_debug_seq
                                                    } ;
                                                    encrypt2.send_message(request2, options, function (response2, request_filename) {
                                                        var pgm = service + '.process_incoming_message.' + request.msgtype + '.send_w3_start_mt send_message callback/' + group_debug_seq + ': ';
                                                        if (!response2 || response2.error) {
                                                            error = ['Money transaction post processing failed', 'w3_start_mt message was not send', 'error = ' + JSON.stringify(response2)];
                                                            report_error(pgm, error, {group_debug_seq: group_debug_seq});
                                                            return cb(error.join('. '));
                                                        }
                                                        console.log(pgm + 'response2        = ' + JSON.stringify(response2));
                                                        console.log(pgm + 'request_filename = ' + JSON.stringify(request_filename));
                                                        if (!ls.w_files) ls.w_files = {} ;
                                                        ls.w_files[request_filename] = true ;
                                                        // mark w3_start_mt message as sent. do not sent again
                                                        session_info.w3_start_mt_sent_at = new Date().getTime() ;
                                                        session_info.this_status = options.status ;
                                                        save_w_session(session_info, {group_debug_seq: group_debug_seq}, function() {
                                                            z_publish({publish: true, reason: request_filename});
                                                            cb(null);
                                                        }) ;
                                                    }); // send_message callback

                                                }; // send_w3_start_mt

                                                // 2) compare jsons in incoming request with money transactions in ls
                                                // should be 100% identical except added address or return address (added by money transaction receiver)
                                                // check number of money transactions
                                                if (request.money_transactions.length != session_info.money_transactions.length) {
                                                    error = [
                                                        'Money transaction cannot start',
                                                        'Different number of rows',
                                                        session_info.money_transactions.length + ' row' + (session_info.money_transactions.length > 1 ? 's' : '') + ' in your transaction',
                                                        request.money_transactions.length + ' row' + (request.money_transactions.length > 1 ? 's' : '') + ' in contact transaction'
                                                    ];
                                                    report_error(pgm, error, {group_debug_seq: group_debug_seq, end_group_operation: false});
                                                    return send_w3_start_mt(error.join('. '));
                                                }
                                                // compare money transactions one by one
                                                for (i = 0; i < request.money_transactions.length; i++) {
                                                    my_money_transaction = session_info.money_transactions[i];
                                                    contact_money_transaction = request.money_transactions[i];
                                                    error = [];
                                                    if (my_money_transaction.action != contact_money_transaction.action) {
                                                        error.push('your action is ' + my_money_transaction.action);
                                                        error.push('contact action is ' + my_money_transaction.action);
                                                    }
                                                    if (my_money_transaction.code != contact_money_transaction.code) {
                                                        error.push('your code is ' + my_money_transaction.code);
                                                        error.push('contact code is ' + contact_money_transaction.code);
                                                    }
                                                    if (my_money_transaction.amount != contact_money_transaction.amount) {
                                                        error.push('your amount is ' + my_money_transaction.amount);
                                                        error.push('contact amount is ' + contact_money_transaction.amount);
                                                    }

                                                    if (my_money_transaction.json.address) {
                                                        if (my_money_transaction.json.address != contact_money_transaction.json.address) {
                                                            error.push('your address is ' + my_money_transaction.json.address);
                                                            error.push('contact address is ' + contact_money_transaction.json.address);
                                                        }
                                                    }
                                                    else {
                                                        // add missing address from incoming w3_check_mt message
                                                        my_money_transaction.json.address = contact_money_transaction.json.address;
                                                    }

                                                    if (my_money_transaction.json.return_address) {
                                                        if (my_money_transaction.json.return_address != contact_money_transaction.json.return_address) {
                                                            error.push('your return_address is ' + my_money_transaction.json.return_address);
                                                            error.push('contact return_address is ' + contact_money_transaction.json.return_address);
                                                        }
                                                    }
                                                    else {
                                                        // add missing return_address from incoming w3_check_mt message
                                                        my_money_transaction.json.return_address = contact_money_transaction.json.return_address;
                                                    }

                                                    if (error.length) {
                                                        error.unshift('Difference' + (error.length / 2 > 1 ? 's' : '') + ' in row ' + (i + 1));
                                                        error.unshift('Money transaction cannot start');
                                                        report_error(pgm, error, {group_debug_seq: group_debug_seq, end_group_operation: false});
                                                        return send_w3_start_mt(error.join('. '));
                                                    }
                                                } // for i (money_transactions)

                                                // money transaction in both wallets are 100% identical.
                                                console.log(pgm + 'OK w3_check_mt message. all addresses ready. ready to execute transaction(s)');

                                                // encrypt and save changed session info
                                                console.log(pgm + 'session_info = ' + JSON.stringify(session_info));
                                                save_w_session(session_info, {group_debug_seq: group_debug_seq}, function () {
                                                    // encrypt1.encrypt_json(session_info, {encryptions: [2], group_debug_seq: group_debug_seq}, function (encrypted_session_info) {
                                                    var pgm = service + '.process_incoming_message.' + request.msgtype + ' save_w_session callback 2/' + group_debug_seq + ': ';
                                                    var send_money, ls_updated, wallet_was_open, optional_open_wallet, optional_close_wallet;
                                                    try {

                                                        if (error.length) {
                                                            // stop. error has already been handled in send_w3_start_mt
                                                            console.log(pgm + error.join('. '));
                                                            return;
                                                        }
                                                        // 2) call ropsten (the test network)
                                                        console.log(pgm + 'call relevant ether2 api commands (send money, get transaction)');
                                                        console.log(pgm + 'keep track of transaction status in ls');
                                                        console.log(pgm + 'todo: must update file with transaction status');
                                                        console.log(pgm + 'send w3_start_mt message to other wallet');

                                                        // open wallet before any send_money calls
                                                        wallet_was_open = (wallet_info.status == 'Open');
                                                        optional_open_wallet = function (cb) {
                                                            var is_wallet_required, i, money_transaction, error;
                                                            if (wallet_was_open) return cb();
                                                            // is wallet required in send_money loop?
                                                            is_wallet_required = false;
                                                            for (i = 0; i < session_info.money_transactions.length; i++) {
                                                                money_transaction = session_info.money_transactions[i];
                                                                if ((money_transaction.action == 'Send') && (money_transaction.code == 'tETH')) is_wallet_required = true;
                                                            }
                                                            if (!is_wallet_required) return cb(); // nothing to send
                                                            // wallet log in is required
                                                            if (etherService.is_login_info_missing(status)) {
                                                                error = ['Money transaction failed', 'Cannot send money', 'No wallet log in was found'];
                                                                console.log(pgm + 'todo: mark money transaction as aborted in ls');
                                                                console.log(pgm + 'todo: update file with money transaction status');
                                                                return report_error(pgm, error, {group_debug_seq: group_debug_seq});
                                                            }
                                                            // open wallet
                                                            etherService.openWallet(status, function (error) {
                                                                try {
                                                                    if (error && (wallet_info.status != 'Open')) {
                                                                        error = ['Money transaction failed', 'Cannot send money', 'Open wallet request failed', error];
                                                                        console.log(pgm + 'todo: mark money transaction as aborted in ls');
                                                                        console.log(pgm + 'todo: update file with money transaction status');
                                                                        return report_error(pgm, error, {group_debug_seq: group_debug_seq});
                                                                    }
                                                                    // continue with send_money operations
                                                                    cb();
                                                                }
                                                                catch (e) {
                                                                    error = ['Money transaction failed', 'Cannot send money', 'Open wallet request failed', e.message];
                                                                    console.log(pgm + 'todo: mark money transaction as aborted in ls');
                                                                    console.log(pgm + 'todo: update file with money transaction status');
                                                                    return report_error(pgm, error, {group_debug_seq: group_debug_seq});
                                                                }
                                                            }); // openWallet callback

                                                        }; // optional_open_wallet

                                                        optional_close_wallet = function (cb) {
                                                            if (wallet_was_open) return cb();
                                                            if (wallet_info.status != 'Open') return cb();
                                                            // close wallet
                                                            etherService.close_wallet(function (res) {
                                                                console.log(pgm + 'res = ' + JSON.stringify(res));
                                                                cb();
                                                            });
                                                        }; // optional_close_wallet


                                                        optional_open_wallet(function () {
                                                            var send_money;

                                                            // send money loop (if any Send money transactions in money_transactions array)
                                                            ls_updated = false;
                                                            send_money = function (i) {
                                                                var pgm = service + '.process_incoming_message.' + request.msgtype + '.send_money/' + group_debug_seq + ': ';
                                                                var money_transaction, ether_bn, wei_bn, wei_s;
                                                                if (i >= session_info.money_transactions.length) {
                                                                    console.log(pgm + 'done sending money. ');
                                                                    save_w_session(session_info, {group_debug_seq: group_debug_seq}, function () {
                                                                        console.log(pgm + 'saved session_info in ls');
                                                                        optional_close_wallet(function () {
                                                                            send_w3_start_mt(null, function () {
                                                                                MoneyNetworkAPILib.debug_group_operation_end(group_debug_seq);
                                                                            });
                                                                        });
                                                                    });
                                                                    //encrypt1.encrypt_json(session_info, {encryptions: [2], group_debug_seq: group_debug_seq}, function (encrypted_session_info) {
                                                                    //    var pgm = service + '.process_incoming_message.' + request.msgtype + ' encrypt json callback 3/' + group_debug_seq + ': ';
                                                                    //    var sha256;
                                                                    //    sha256 = CryptoJS.SHA256(session_info.money_transactionid).toString();
                                                                    //    ls.w_sessions[auth_address][sha256] = encrypted_session_info;
                                                                    //    console.log(pgm + 'session_info.money_transactionid = ' + session_info.money_transactionid + ', sha256 = ' + sha256);
                                                                    //    ls_save() ;
                                                                    //})
                                                                    return;
                                                                }
                                                                money_transaction = session_info.money_transactions[i];
                                                                if (money_transaction.action != 'Send') return send_money(i + 1); // Receive money. must be started by contact wallet
                                                                if (money_transaction.code != 'tETH') return send_money(i + 1); // not test Bitcoins
                                                                if (money_transaction.ether_send_at) {
                                                                    console.log(pgm + 'money transaction has already been sent to ropsten (the test network). money_transaction = ' + JSON.stringify(money_transaction));
                                                                    return send_money(i + 1);
                                                                }
                                                                ether_bn = new BigNumber(money_transaction.amount);
                                                                wei_bn = ether_bn.times(wei_factor);
                                                                wei_s = bn_toFixed(wei_bn, 0, false) ;
                                                                money_transaction.ether_send_at = new Date().getTime();
                                                                // wallet to wallet communication. send money operation has already been confirmed in UI. confirm = false
                                                                etherService.send_money(money_transaction.json.address, wei_s, false, function (err, result, fee) {
                                                                    var pgm = service + '.process_incoming_message.' + request.msgtype + '.send_money send_money callback/' + group_debug_seq + ': ';
                                                                    var ether_s, wei_s, fee_wei_bn, fee_ether_bn, fee_ether_s, fee_wei_s ;
                                                                    try {
                                                                        if (err) {
                                                                            if ((typeof err == 'object') && err.message) err = err.message;
                                                                            money_transaction.ether_send_error = err;
                                                                            // report_error(pgm, ["Money was not sent", err], {group_debug_seq: group_debug_seq, end_group_operation: false});
                                                                            report_error(pgm, ["Money was not sent", err]); // new group_debug_seq for notification
                                                                            console.log(pgm + 'todo: retry, abort or ?')
                                                                        }
                                                                        else {
                                                                            console.log(pgm + 'issue #11 Add fee info in send money notifications') ;
                                                                            money_transaction.ether_send_ok = result.hash;
                                                                            ether_s = bn_toFixed(ether_bn, 18, true) ;
                                                                            wei_s = bn_toFixed(wei_bn, 0, true) ;
                                                                            fee_wei_bn = new BigNumber(fee) ;
                                                                            fee_ether_bn = fee_wei_bn.dividedBy(wei_factor) ;
                                                                            fee_ether_s = bn_toFixed(fee_ether_bn, 18, true) ;
                                                                            fee_wei_s = bn_toFixed(fee_wei_bn, 0, true) ;
                                                                            report_error(pgm, [ether_s + ' tETH / ' + wei_s + ' test wei', 'was sent to ' + session_info.contact.alias, 'result = ' + result.hash, 'Fee ' + fee_ether_s + ' tETH / ' + fee_wei_s + ' test wei'], {type: 'done'}) ; // new group_debug_seq for notification
                                                                        }
                                                                        console.log(pgm + 'money_transaction = ' + JSON.stringify(money_transaction));

                                                                        ls_updated = true;
                                                                        // next money transaction
                                                                        send_money(i + 1);

                                                                    }
                                                                    catch (e) {
                                                                        // receive offline message w3_check_mt failed.
                                                                        if (!e) return; // exception in MoneyNetworkAPI instance
                                                                        console.log(pgm + e.message);
                                                                        console.log(e.stack);
                                                                        report_error(pgm, ["JS exception", e.message], {log: false});
                                                                        throw(e);
                                                                    }

                                                                });
                                                            };
                                                            send_money(0);

                                                        }); // optional_open_wallet callback 4

                                                    }
                                                    catch (e) {
                                                        // receive offline message w3_check_mt failed.
                                                        if (!e) return; // exception in MoneyNetworkAPI instance
                                                        console.log(pgm + e.message);
                                                        console.log(e.stack);
                                                        report_error(pgm, ["JS exception", e.message], {log: false});
                                                        throw(e);
                                                    }
                                                }); // save_w_session callback 3

                                            }
                                            catch (e) {
                                                // receive offline message w3_check_mt failed.
                                                if (!e) return; // exception in MoneyNetworkAPI instance
                                                console.log(pgm + e.message);
                                                console.log(e.stack);
                                                report_error(pgm, ["JS exception", e.message], {log: false});
                                                throw(e);
                                            }
                                        }) ; // delete_pubkeys_msg callback 2

                                    }
                                    catch (e) {
                                        // receive offline message w3_check_mt failed.
                                        if (!e) return ; // exception in MoneyNetworkAPI instance
                                        console.log(pgm + e.message);
                                        console.log(e.stack);
                                        report_error(pgm, ["JS exception", e.message], {log: false}) ;
                                        throw(e);
                                    }
                                }); // read_w_session callback 1

                            }
                            catch (e) {
                                // receive offline message w3_check_mt failed.
                                if (!e) return ; // exception in MoneyNetworkAPI instance
                                console.log(pgm + e.message);
                                console.log(e.stack);
                                report_error(pgm, ["JS exception", e.message], {log: false}) ;
                                throw(e);
                            }
                        })() ;
                        return; // no response to offline w3_check_mt message
                        // w3_check_mt
                    }
                    else if (request.msgtype == 'w3_start_mt') {
                        // sender to receiver: after w3_check_mt message. start or abort money transaction(s)
                        // request = {"msgtype":"w3_start_mt"}
                        (function w3_start_mt(){
                            var pgm, error ;
                            try {
                                pgm = service + '.process_incoming_message.' + request.msgtype + '/' + group_debug_seq + ': ' ;
                                read_w_session(encrypt2.sessionid, {group_debug_seq: group_debug_seq, ip_external: true}, function (session_info)  {
                                    var pgm = service + '.process_incoming_message.' + request.msgtype + ' read_w_session callback 1/' + group_debug_seq + ': ';
                                    try {
                                        var wallet_was_open, optional_open_wallet, optional_close_wallet, send_w3_end_mt,
                                            error, i, money_transaction, no_pay_ok, no_pay_error, delete_old_messages ;

                                        console.log(pgm + 'session_info = ' + JSON.stringify(session_info));
                                        if (!session_info) {
                                            error = ['Money transaction cannot start', 'w3_check_mt message with unknown sessionid', encrypt2.sessionid];
                                            return report_error(pgm, error, {group_debug_seq: group_debug_seq}) ;
                                        }

                                        if (session_info.w3_start_mt_received_at) {
                                            // ignore. already received. must be a wallet page load. see load_w_sessions
                                            MoneyNetworkAPILib.debug_group_operation_end(group_debug_seq) ;
                                            return ;
                                        }

                                        // 1) must be receiver
                                        if (session_info.sender) {
                                            console.log(pgm + 'warning. is sender of money transaction. ignoring incoming w3_start_mt message. only sent from sender of money transaction to client/receiver of money transaction');
                                            MoneyNetworkAPILib.debug_group_operation_end(group_debug_seq) ;
                                            return;
                                        }

                                        // cleanup old outgoing files:
                                        // - is "receiver"
                                        // - is receiving w3_start_mt message from "sender"
                                        // - "sender" must have received 'w3_pubkeys' and "w3_check_mt" messages from "receiver"
                                        // - find and delete old pubkeys and w3_check_mt messages from receiver to sender
                                        delete_old_messages = function (cb) {
                                            delete_old_msg({session_info: session_info, msg_name: 'w3_pubkeys', encrypt: encrypt2, group_debug_seq: group_debug_seq}, function() {
                                                delete_old_msg({session_info: session_info, msg_name: 'w3_check_mt', encrypt: encrypt2, group_debug_seq: group_debug_seq}, cb) ;
                                            }) ;
                                        } ; // delete_w3_check_mt_msg

                                        if (request.error) {
                                            // w3_check_mt check failed. money transaction was aborted by sender of money transaction
                                            console.log(pgm + 'todo: mark money transaction as aborted in ls');
                                            console.log(pgm + 'todo: update file with money transaction status');
                                            delete_old_messages(function() {
                                                report_error(pgm, error, {group_debug_seq: group_debug_seq}) ;
                                            }) ;
                                            return ;
                                        }

                                        // has pubkeys from other wallet been received from other wallet? cannot encrypt w3_end_mt without public keys from other wallet session
                                        if (!encrypt2.other_session_pubkey || !encrypt2.other_session_pubkey2) {
                                            console.log(pgm + 'waiting for pubkeys message from other wallet session. cannot encrypt send w3_end_mt message without public keys') ;
                                            wait_for_pubkeys_message({
                                                encrypt2: encrypt2,
                                                session_info: session_info,
                                                in_filename: filename,
                                                in_msg_name:'w3_start_mt',
                                                out_msg_name: 'w3_end_mt',
                                                group_debug_seq: group_debug_seq
                                            }) ;
                                            return ;
                                        }

                                        delete_old_messages(function() {
                                            var pgm = service + '.process_incoming_message.' + request.msgtype + ' delete_w3_check_mt_msg callback 2/' + group_debug_seq + ': ';
                                            var send_w3_end_mt, error ;
                                            try {
                                                // receiver to sender: send w3_end_mt to sender of money transaction. error: w3_start_mt validation error, cb: next step
                                                send_w3_end_mt = function (error, cb) {
                                                    var request2, i, money_transaction, optional, options ;
                                                    if (error && (typeof error != 'string')) {
                                                        error = 'invalid send_w3_end_mt call. First parameter error must be null or a string' ;
                                                        console.log(pgm + error) ;
                                                        throw pgm + error;
                                                    }
                                                    if (!cb) cb = function () {};
                                                    if (typeof cb != 'function') {
                                                        error = 'invalid send_w3_end_mt call. second parameter cb must be null or a callback function' ;
                                                        console.log(pgm + error) ;
                                                        throw pgm + error;
                                                    }
                                                    request2 = {
                                                        msgtype: 'w3_end_mt',
                                                        pay_results: []
                                                    } ;
                                                    if (error) request2.error = error ;
                                                    for (i=0 ; i<session_info.money_transactions.length ; i++) {
                                                        money_transaction = session_info.money_transactions[i] ;
                                                        request2.pay_results.push(money_transaction.ether_send_ok || money_transaction.ether_send_error) ;
                                                    }
                                                    if (!session_info.files) session_info.files = {} ;
                                                    options = {
                                                        optional: session_info.ip_external ? 'o' : null, // use offline optional file (-o) or normal file
                                                        subsystem: 'w3',
                                                        files: session_info.files,
                                                        status: '4: w3_end_mt sent, waiting for w3_cleanup_mt',
                                                        group_debug_seq: group_debug_seq
                                                    } ;
                                                    encrypt2.send_message(request2, options, function (response2, request_filename) {
                                                        var pgm = service + '.process_incoming_message.' + request.msgtype + '.send_w3_end_mt send_message callback/' + group_debug_seq + ': ';
                                                        if (!response2 || response2.error) {
                                                            error = ['Money transaction stopped', 'w3_end_mt message was not send', 'error = ' + JSON.stringify(response2)];
                                                            save_w_session(session_info, {group_debug_seq: group_debug_seq}, function() {
                                                                report_error(pgm, error, {group_debug_seq: group_debug_seq}, function() {
                                                                    cb(error.join('. '))
                                                                });
                                                            }) ;
                                                            return ;
                                                        }
                                                        console.log(pgm + 'response2        = ' + JSON.stringify(response2));
                                                        console.log(pgm + 'request_filename = ' + JSON.stringify(request_filename));
                                                        if (!ls.w_files) ls.w_files = {} ;
                                                        ls.w_files[request_filename] = true ;
                                                        // mark w3_end_mt message as sent. do not sent again
                                                        session_info.w3_end_mt_sent_at = new Date().getTime() ;
                                                        session_info.this_status = options.status ;
                                                        cleanup_session_info(session_info) ;
                                                        save_w_session(session_info, {group_debug_seq: group_debug_seq}, function() {
                                                            z_publish({publish: true, reason: request_filename});
                                                            cb(null)
                                                        }) ;
                                                    }); // send_message callback
                                                } ; // send_w3_end_mt

                                                // validate w3_start_mt
                                                // - pay_results.length == money_transactions.length
                                                // - pay_resulls row (is receiver):
                                                //  - null if sender is requesting money,
                                                //  - send OK (ether transactionid) or error message if receiver is sender of money transaction (request money)
                                                if (request.pay_results.length != session_info.money_transactions.length) {
                                                    // w3_start_mt request is invalid. send w3_end_mt error message
                                                    error = 'Invalid number of pay_results rows. Expected ' + session_info.money_transactions.length + ' rows. Found ' + request.pay_results.length + ' rows' ;
                                                    report_error(pgm, error, {group_debug_seq: group_debug_seq}, function() {
                                                        send_w3_end_mt(error);
                                                    }) ;
                                                    return ;
                                                }
                                                no_pay_ok = 0 ;
                                                no_pay_error = 0 ;
                                                for (i=0 ; i<session_info.money_transactions.length ; i++) {
                                                    money_transaction = session_info.money_transactions[i] ;
                                                    if (money_transaction.action == 'Send') {
                                                        // is receiver. sender is sending money. pay_results must have ether OK or Error result
                                                        if (request.pay_results[i] == null) {
                                                            error = 'Error. pay_results[' + i + '] is missing. Expected ether transaction id or error message' ;
                                                            report_error(pgm, error, {group_debug_seq: group_debug_seq}, function () {
                                                                send_w3_end_mt(error);
                                                            }) ;
                                                            return ;
                                                        }
                                                        else if (request.pay_results[i].match(/^0x[0-9a-f]{64}$/)) {
                                                            // could be a ether transaction id but must be validated in next step
                                                            no_pay_ok++ ;
                                                            money_transaction.ether_receive_ok = request.pay_results[i] ;
                                                        }
                                                        else {
                                                            // must be a error message
                                                            no_pay_error++ ;
                                                            money_transaction.ether_receive_error = request.pay_results[i] ;
                                                            report_error(pgm, ['No money was received from ' + session_info.contact.alias, request.pay_results[i]], {group_debug_seq: group_debug_seq, end_group_operation: false}) ;
                                                        }
                                                    }
                                                    else {
                                                        // is receiver. sender is requesting money. pay_results[i] must null
                                                        if (request.pay_results[i] != null) {
                                                            error = 'Error. Expected pay_results[' + i + '] to be null. Found ' + request.pay_results[i] ;
                                                            report_error(pgm, error, {group_debug_seq: group_debug_seq}, function () {
                                                                send_w3_end_mt(error);
                                                            }) ;
                                                            return ;
                                                        }
                                                    }
                                                }

                                                // open wallet before any send_money or get transaction calls
                                                wallet_was_open = (wallet_info.status == 'Open') ;
                                                optional_open_wallet = function (cb) {
                                                    var is_wallet_required, i, money_transaction, error ;
                                                    if (wallet_was_open) return cb() ;
                                                    if (!no_pay_ok) return cb() ; //
                                                    // is wallet required in send_money loop?
                                                    is_wallet_required = false ;
                                                    if (no_pay_ok) is_wallet_required = true ;
                                                    for (i=0 ; i<session_info.money_transactions.length ; i++) {
                                                        money_transaction = session_info.money_transactions[i];
                                                        if ((money_transaction.action == 'Request') && (money_transaction.code == 'tETH')) is_wallet_required = true ;
                                                    }
                                                    if (!is_wallet_required) return cb() ; // nothing to send and no transaction ids to validate
                                                    // wallet log in is required
                                                    if (etherService.is_login_info_missing(status)) {
                                                        error = ['Money transaction failed', 'Cannot open wallet', 'No wallet log in was found'] ;
                                                        console.log(pgm + 'todo: save received transaction in ls (no_pay_ok>0 or no_pay_error>0)');
                                                        console.log(pgm + 'todo: update file with money transaction status');
                                                        // todo: send w3_end_mt (publish required) or report_error first?
                                                        return report_error(pgm, error, {group_debug_seq: group_debug_seq}) ;
                                                    }
                                                    // open wallet
                                                    etherService.openWallet(status, function (error) {
                                                        try {
                                                            if (error && (wallet_info.status != 'Open')) {
                                                                error = ['Money transaction failed', 'Open wallet request failed', error] ;
                                                                console.log(pgm + 'todo: save updated money transaction in ls');
                                                                console.log(pgm + 'todo: update file with money transaction status');
                                                                return report_error(pgm, error, {group_debug_seq: group_debug_seq}) ;
                                                            }
                                                            // continue with send_money and check transaction operations
                                                            cb() ;
                                                        }
                                                        catch (e) {
                                                            error = ['Money transaction failed', 'Open wallet request failed', e.message];
                                                            console.log(pgm + 'todo: save updated money transaction in ls');
                                                            console.log(pgm + 'todo: update file with money transaction status');
                                                            return report_error(pgm, error, {group_debug_seq: group_debug_seq}) ;
                                                        }
                                                    }); // openWallet callback

                                                } ; // optional_open_wallet

                                                optional_close_wallet = function (cb) {
                                                    if (wallet_was_open) return cb() ;
                                                    if (wallet_info.status != 'Open') return cb() ;
                                                    // close wallet
                                                    etherService.close_wallet(function (res) {
                                                        console.log(pgm + 'res = ' + JSON.stringify(res)) ;
                                                        cb() ;
                                                    });
                                                } ; // optional_close_wallet

                                                // start callback sequence (open wallet, send_or_check_money, close wallet)
                                                optional_open_wallet(function () {
                                                    var pgm = service + '.process_incoming_message.' + request.msgtype + ' optional_open_wallet callback 3/' + group_debug_seq + ': ';
                                                    var send_money, check_money, send_or_check_money ;

                                                    send_money = function (i) {
                                                        var pgm, money_transaction, ether_bn, wei_bn, wei_s, error ;
                                                        try {
                                                            pgm = service + '.process_incoming_message.' + request.msgtype + '.send_money/' + group_debug_seq + ': ' ;
                                                            money_transaction = session_info.money_transactions[i];
                                                            // is receiver. action must be Request
                                                            if (money_transaction.action != 'Request') throw pgm + 'invalid call. send_money. Is receiver and action is not Request' ;
                                                            if (money_transaction.ether_send_ok) return send_or_check_money(i + 1); // stop. money has already been sent
                                                            ether_bn = new BigNumber(money_transaction.amount);
                                                            wei_bn = ether_bn.times(wei_factor);
                                                            wei_s = bn_toFixed(wei_bn, 0, false) ;
                                                            money_transaction.ether_send_at = new Date().getTime();
                                                            // wallet to wallet communication. send money operation has already been confirmed in UI. confirm = false
                                                            etherService.send_money(money_transaction.json.address, wei_s, false, function (err, result, fee) {
                                                                var pgm, ether_s, wei_s, error, fee_wei_bn, fee_ether_bn, fee_ether_s, fee_wei_s ;
                                                                try {
                                                                    pgm = service + '.process_incoming_message.' + request.msgtype + '.send_money send_money callback/' + group_debug_seq + ': ' ;
                                                                    if (err) {
                                                                        if ((typeof err == 'object') && err.message) err = err.message;
                                                                        money_transaction.ether_send_error = err;
                                                                        // report_error(pgm, err,  {group_debug_seq: group_debug_seq, end_group_operation: false}) ;
                                                                        report_error(pgm, err) ; // new group_debug_seq for notification
                                                                        console.log(pgm + 'todo: retry, abort or ?')
                                                                    }
                                                                    else {
                                                                        console.log(pgm + 'issue #11 Add fee info in send money notifications') ;
                                                                        money_transaction.ether_send_ok = result.hash;
                                                                        ether_s = bn_toFixed(ether_bn, 18) ;
                                                                        wei_s = bn_toFixed(wei_bn, 0, true) ;
                                                                        fee_wei_bn = new BigNumber(fee) ;
                                                                        fee_ether_bn = fee_wei_bn.dividedBy(wei_factor) ;
                                                                        fee_ether_s = bn_toFixed(fee_ether_bn, 18, true) ;
                                                                        fee_wei_s = bn_toFixed(fee_wei_bn, 0, true) ;
                                                                        report_error(pgm, [ether_s + ' tETH / ' + wei_s + ' test wei', 'was sent to ' + session_info.contact.alias, 'result = ' + result.hash, 'Fee ' + fee_ether_s + ' tETH / ' + fee_wei_s + ' test wei'], {type: 'done'}) ; // new group_debug_seq for notification
                                                                    }
                                                                    console.log(pgm + 'money_transaction = ' + JSON.stringify(money_transaction));
                                                                    // next money transaction
                                                                    send_or_check_money(i + 1);
                                                                }
                                                                catch (e) {
                                                                    // receive message w3_start_mt failed.
                                                                    if (!e) return ; // exception in MoneyNetworkAPI instance
                                                                    error = e.message ? e.message : e ;
                                                                    console.log(pgm + error);
                                                                    if (e.stack) console.log(e.stack);
                                                                    report_error(pgm, ['Money transaction failed', "JS exception", error], {log: false, group_debug_seq: group_debug_seq}) ;
                                                                    throw(e);
                                                                }
                                                            }); // send_money callback
                                                        }
                                                        catch (e) {
                                                            // receive message w3_start_mt failed.
                                                            if (!e) return ; // exception in MoneyNetworkAPI instance
                                                            error = e.message ? e.message : e ;
                                                            console.log(pgm + error);
                                                            if (e.stack) console.log(e.stack);
                                                            report_error(pgm, ['Money transaction failed', "JS exception", error], {log: false, group_debug_seq: group_debug_seq}) ;
                                                            throw(e);
                                                        }
                                                    } ; // send_money

                                                    check_money = function (i) {
                                                        var pgm, money_transaction ;
                                                        try {
                                                            pgm = service + '.process_incoming_message.' + request.msgtype + '.check_money/' + group_debug_seq + ': ';
                                                            money_transaction = session_info.money_transactions[i];
                                                            if (money_transaction.action != 'Send') throw pgm + 'invalid call. Is receiver and action is not Send' ;
                                                            if (!money_transaction.ether_receive_ok) throw pgm + 'invalid call. No txhash received from sender' ;
                                                            // check ether transactionid
                                                            etherService.get_transaction(money_transaction.ether_receive_ok, function (err, tx) {
                                                                var pgm, expected_amount_ether_bn, expected_amount_ether_s, expected_amount_wei_bn, expected_amount_wei_s,
                                                                    received_amount_ether_bn, received_amount_ether_s, received_amount_wei_bn, received_amount_wei_s,
                                                                    error ;
                                                                try {
                                                                    pgm = service + '.process_incoming_message.' + request.msgtype + '.check_money get_transaction callback/' + group_debug_seq + ': ';
                                                                    console.log(pgm + 'err = ' + JSON.stringify(err)) ;
                                                                    console.log(pgm + 'tx = ' + JSON.stringify(tx)) ;
                                                                    if (err) {
                                                                        // get transaction failed. maybe API error. maybe invalid transactionid
                                                                        money_transaction.ether_receive_error = 'Receive money failed. Could not verify received ether transaction ' + money_transaction.ether_receive_ok + '. ether error = ' + err ;
                                                                        delete money_transaction.ether_receive_ok ;
                                                                        return send_or_check_money(i + 1);
                                                                    }
                                                                    // check tx
                                                                    if (!tx) {
                                                                        money_transaction.ether_receive_error = 'Receive money failed. Could not verify received ether transaction ' + money_transaction.ether_receive_ok + '. tx is null' ;
                                                                        delete money_transaction.ether_receive_ok ;
                                                                        return send_or_check_money(i + 1);
                                                                    }
                                                                    if (!tx.value || !tx.value._bn) {
                                                                        money_transaction.ether_receive_error = 'Receive money failed. Could not verify received ether transaction ' + money_transaction.ether_receive_ok + '. tx.value._bn is empty' ;
                                                                        delete money_transaction.ether_receive_ok ;
                                                                        return send_or_check_money(i + 1);
                                                                    }
                                                                    // check amount
                                                                    expected_amount_ether_bn = new BigNumber(money_transaction.amount) ;
                                                                    expected_amount_wei_bn = expected_amount_ether_bn.multipliedBy(wei_factor) ;
                                                                    received_amount_wei_s = tx.value.toString(10) ;
                                                                    received_amount_wei_bn = new BigNumber(received_amount_wei_s) ;
                                                                    console.log(pgm + 'expected_amount = ' + expected_amount_wei_bn.toString(10) + ', received_amount = ' + received_amount_wei_bn.toString(10)) ;
                                                                    expected_amount_ether_s = bn_toFixed(expected_amount_ether_bn, 18, true) ;
                                                                    expected_amount_wei_s = bn_toFixed(expected_amount_wei_bn, 0, true) ;
                                                                    if (expected_amount_wei_bn.eq(received_amount_wei_bn)) {
                                                                        console.log(pgm + 'Everything is fine. todo: notification in UI.') ;
                                                                        report_error(pgm, [expected_amount_ether_s + ' tETH / ' + expected_amount_wei_s + ' test wei', 'was received from ' + session_info.contact.alias], {type: 'done'}) ; // use new group_debug_seq for notification
                                                                        return send_or_check_money(i + 1);
                                                                    }
                                                                    console.log(pgm + 'error: expected amount <> received amount') ;
                                                                    received_amount_ether_bn = received_amount_wei_bn.dividedBy(wei_factor) ;
                                                                    received_amount_ether_s = bn_toFixed(received_amount_ether_bn, 18, true) ;
                                                                    received_amount_wei_s = bn_toFixed(received_amount_wei_bn, 0, true) ;
                                                                    error = [ 'Expected ' + expected_amount_ether_s + ' tETH / ' + expected_amount_wei_s + ' test wei', 'Received ' + received_amount_ether_s + ' tETH / ' + received_amount_wei_s + ' test wei'] ;
                                                                    money_transaction.ether_receive_error = error.join('. ') ;
                                                                    error.splice(1,0, 'from ' + session_info.contact.alias) ;
                                                                    report_error(pgm, error, {type: 'error'}) ; // todo: use new group_debug_seq for notification
                                                                    send_or_check_money(i + 1);
                                                                }
                                                                catch (e) {
                                                                    // receive message w3_start_mt failed.
                                                                    if (!e) return ; // exception in MoneyNetworkAPI instance
                                                                    error = e.message ? e.message : e ;
                                                                    console.log(pgm + error);
                                                                    if (e.stack) console.log(e.stack);
                                                                    report_error(pgm, ['Money transaction failed', "JS exception", error], {log: false, group_debug_seq: group_debug_seq}) ;
                                                                    throw(e);
                                                                }
                                                            }) ;
                                                        }
                                                        catch (e) {
                                                            // receive message w3_start_mt failed.
                                                            if (!e) return ; // exception in MoneyNetworkAPI instance
                                                            error = e.message ? e.message : e ;
                                                            console.log(pgm + error);
                                                            if (e.stack) console.log(e.stack);
                                                            report_error(pgm, ['Money transaction failed', "JS exception", error], {log: false, group_debug_seq: group_debug_seq}) ;
                                                            throw(e);
                                                        }
                                                    } ; // check_money

                                                    // send/check money loop (if any Send or check money transactions in money_transactions array)
                                                    send_or_check_money = function (i) {
                                                        var pgm, money_transaction, error;
                                                        try {
                                                            pgm = service + '.process_incoming_message.' + request.msgtype + '.send_or_check_money/' + group_debug_seq + ': '
                                                            if (i >= session_info.money_transactions.length) {
                                                                console.log(pgm + 'done sending and checking money');
                                                                // mark w3_start_mt message as received. do not process again
                                                                session_info.w3_start_mt_received_at = new Date().getTime() ;
                                                                save_w_session(session_info, {group_debug_seq: group_debug_seq}, function () {
                                                                    console.log(pgm + 'saved session_info in ls') ;
                                                                    optional_close_wallet(function() {
                                                                        MoneyNetworkAPILib.debug_group_operation_end(group_debug_seq) ;
                                                                        send_w3_end_mt() ;
                                                                    }) ;
                                                                }) ;
                                                                return;
                                                            }
                                                            // is receiver
                                                            money_transaction = session_info.money_transactions[i];
                                                            if (!money_transaction) console.log(pgm + 'error. session_info.money_transactions.length = ' + session_info.money_transactions.length + ', i = ' + i) ;
                                                            if (money_transaction.code != 'tETH') return send_or_check_money(i + 1); // not test Bitcoins
                                                            if (money_transaction.action == 'Request') return send_money(i) ;
                                                            if (money_transaction.ether_receive_ok) return check_money(i) ;
                                                            send_or_check_money(i+1) ;
                                                        }
                                                        catch (e) {
                                                            // receive message w3_start_mt failed.
                                                            if (!e) return ; // exception in MoneyNetworkAPI instance
                                                            error = e.message ? e.message : e ;
                                                            console.log(pgm + error);
                                                            if (e.stack) console.log(e.stack);
                                                            report_error(pgm, ['Money transaction failed', "JS exception", error], {log: false, group_debug_seq: group_debug_seq}) ;
                                                            throw(e);
                                                        }
                                                    }; // send_or_check_money
                                                    // start send (action=Request) or check (action=Send) money loop
                                                    send_or_check_money(0);
                                                }) ; // optional_open_wallet callback 3
                                            }
                                            catch (e) {
                                                // receive offline message w3_start_mt failed.
                                                // notification in w3 and mn UI
                                                if (!e) return ; // exception in MoneyNetworkAPI instance
                                                error = e.message ? e.message : e ;
                                                console.log(pgm + error);
                                                if (e.stack) console.log(e.stack);
                                                report_error(pgm, ['Money transaction failed', "JS exception", error], {log: false, group_debug_seq: group_debug_seq}) ;
                                                throw(e);
                                            }
                                        }) ; // delete_w3_check_mt_msg callback 2
                                    }
                                    catch (e) {
                                        // receive offline message w3_start_mt failed.
                                        // notification in w3 and mn UI
                                        if (!e) return ; // exception in MoneyNetworkAPI instance
                                        error = e.message ? e.message : e ;
                                        console.log(pgm + error);
                                        if (e.stack) console.log(e.stack);
                                        report_error(pgm, ['Money transaction failed', "JS exception", error], {log: false, group_debug_seq: group_debug_seq}) ;
                                        throw(e);
                                    }
                                }) ; // read_w_session callback 1
                            }
                            catch (e) {
                                // receive offline message w3_start_mt failed.
                                // notification in w3 and mn UI
                                if (!e) return ; // exception in MoneyNetworkAPI instance
                                error = e.message ? e.message : e ;
                                console.log(pgm + error);
                                if (e.stack) console.log(e.stack);
                                report_error(pgm, ['Money transaction failed', "JS exception", error], {log: false, group_debug_seq: group_debug_seq}) ;
                                throw(e);
                            }
                        })() ;
                        return ; // no OK response to offline w3_start_mt
                        // w3_start_mt
                    }
                    else if (request.msgtype == 'w3_end_mt') {
                        // receiver to sender: after w3_start_mt message. return info about done or failed money transactions
                        //request = {
                        //    "msgtype": "w3_start_mt",
                        //    "pay_results": [null, "91eb16089db248f0102dde22a6c757cfda18a2642f7571b38f9ac159ca3ef449"]
                        //};
                        (function w3_end_mt(){
                            var pgm, error ;
                            try {
                                pgm = service + '.process_incoming_message.' + request.msgtype + '/' + group_debug_seq + ': ';
                                read_w_session(encrypt2.sessionid, {group_debug_seq: group_debug_seq, ip_external: true}, function (session_info)  {
                                    var pgm, wallet_was_open, optional_open_wallet, optional_close_wallet, error, i,
                                        money_transaction, no_pay_ok, no_pay_error, delete_old_w3_start_mt_msg ;
                                    try {
                                        pgm = service + '.process_incoming_message.' + request.msgtype + ' read_w_session callback 1/' + group_debug_seq + ': ';
                                        console.log(pgm + 'session_info = ' + JSON.stringify(session_info));
                                        if (!session_info) {
                                            error = ['Money transaction failed', 'w3_end_mt message with unknown sessionid', encrypt2.sessionid];
                                            return report_error(pgm, error, {group_debug_seq: group_debug_seq}) ;
                                        }

                                        if (session_info.w3_end_mt_received_at) {
                                            // ignore. already received. must be a wallet page load. see load_w_sessions
                                            MoneyNetworkAPILib.debug_group_operation_end(group_debug_seq) ;
                                            return ;
                                        }

                                        // 1) must be sender
                                        if (session_info.receiver) {
                                            console.log(pgm + 'warning. is receiver of money transaction. ignoring incoming w3_end_mt message. only sent from receiver of money transaction to sender of money transaction');
                                            MoneyNetworkAPILib.debug_group_operation_end(group_debug_seq) ;
                                            return;
                                        }

                                        // cleanup old outgoing files:
                                        // - is "sender"
                                        // - is receiving w3_end_mt message from "receiver"
                                        // - "sender" must have received "w3_start_mt" message from "sender"
                                        // - find and delete old w3_start_mt message from sender to receiver

                                        delete_old_w3_start_mt_msg = function(cb) {
                                            delete_old_msg({session_info: session_info, msg_name: 'w3_start_mt', encrypt: encrypt2, group_debug_seq: group_debug_seq}, cb) ;
                                        } ;
                                        delete_old_w3_start_mt_msg(function() {
                                            var pgm, send_w3_cleanup_mt, error ;
                                            try {
                                                pgm = service + '.process_incoming_message.' + request.msgtype + ' delete_old_w3_start_mt_msg callback 2/' + group_debug_seq + ': ' ;
                                                if (request.error) {
                                                    // w3_start_mt check failed. money transaction was aborted by receiver of money transaction
                                                    console.log(pgm + 'todo: mark money transaction as aborted in ls');
                                                    console.log(pgm + 'todo: update file with money transaction status');
                                                    return report_error(pgm, error, {group_debug_seq: group_debug_seq}) ;
                                                }

                                                // sender to receiver: send w3_cleanup_mt to sender of money transaction. error: w3_end_mt validation error, cb: next step
                                                send_w3_cleanup_mt = function (error, cb) {
                                                    var request2, options ;
                                                    if (error && (typeof error != 'string')) {
                                                        error = 'invalid send_w3_cleanup_mt call. First parameter error must be null or a string' ;
                                                        console.log(pgm + error) ;
                                                        throw pgm + error;
                                                    }
                                                    if (!cb) cb = function () {};
                                                    if (typeof cb != 'function') {
                                                        error = 'invalid send_w3_cleanup_mt call. second parameter cb must be null or a callback function' ;
                                                        console.log(pgm + error) ;
                                                        throw pgm + error;
                                                    }
                                                    request2 = {
                                                        msgtype: 'w3_cleanup_mt'
                                                    } ;
                                                    if (error) request2.error = error ;

                                                    // message is NOT added to list of files in session_info.files / ls.w_files
                                                    // == cleanup in next wallet page reload
                                                    options = {
                                                        optional: session_info.ip_external ? 'o' : null, // use offline optional file (-o) or normal file
                                                        subsystem: 'w3',
                                                        status: '5: w3_cleanup_mt sent, done',
                                                        group_debug_seq: group_debug_seq
                                                    } ;
                                                    encrypt2.send_message(request2, options, function (response2, request_filename) {
                                                        var pgm = service + '.process_incoming_message.' + request.msgtype + '.send_w3_end_mt send_message callback/' + group_debug_seq + ': ';
                                                        if (!response2 || response2.error) {
                                                            error = ['Money transaction stopped', 'w3_end_mt message was not send', 'error = ' + JSON.stringify(response2)];
                                                            save_w_session(session_info, {group_debug_seq: group_debug_seq}, function() {
                                                                report_error(pgm, error, {group_debug_seq: group_debug_seq}, function() {
                                                                    cb(error.join('. '))
                                                                });
                                                            }) ;
                                                            return ;
                                                        }
                                                        console.log(pgm + 'response2        = ' + JSON.stringify(response2));
                                                        console.log(pgm + 'request_filename = ' + JSON.stringify(request_filename));
                                                        // mark w3_cleanup_mt message as sent. do not sent again
                                                        session_info.w3_cleanup_mt_sent_at = new Date().getTime() ;
                                                        session_info.this_status = options.status ;
                                                        cleanup_session_info(session_info) ;
                                                        save_w_session(session_info, {group_debug_seq: group_debug_seq}, function() {
                                                            z_publish({publish: true, reason: request_filename});
                                                            cb(null)
                                                        }) ;
                                                    }); // send_message callback
                                                } ; // send_w3_cleanup_mt

                                                // validate w3_end_mt message
                                                // - pay_results.length == money_transactions.length
                                                // - pay_results row (is sender):
                                                //  - null if sender is sending money,
                                                //  - send OK (ether transactionid) or error message if sender is requesting money
                                                if (request.pay_results.length != session_info.money_transactions.length) {
                                                    // w3_start_mt request is invalid. send w3_end_mt error message
                                                    error = 'Invalid number of pay_results rows. Expected ' + session_info.money_transactions.length + ' rows. Found ' + request.pay_results.length + ' rows' ;
                                                    report_error(pgm, error, {group_debug_seq: group_debug_seq}, function() {
                                                        send_w3_cleanup_mt(error) ;
                                                    }) ;
                                                    return ;
                                                }
                                                no_pay_ok = 0 ;
                                                no_pay_error = 0 ;
                                                for (i=0 ; i<session_info.money_transactions.length ; i++) {
                                                    money_transaction = session_info.money_transactions[i] ;
                                                    if (money_transaction.action == 'Request') {
                                                        // is sender. receiver is sending money. pay_results must have ether OK or Error result
                                                        if (request.pay_results[i] == null) {
                                                            error = 'Error. pay_results[' + i + '] is missing. Expected ether transaction id or error message' ;
                                                            report_error(pgm, error, {group_debug_seq: group_debug_seq}, function () {
                                                                send_w3_cleanup_mt(error) ;
                                                            }) ;
                                                            return ;
                                                        }
                                                        else if (request.pay_results[i].match(/^0x[0-9a-f]{64}$/)) {
                                                            // could be a ether transaction id but must be validated in next step
                                                            no_pay_ok++ ;
                                                            money_transaction.ether_receive_ok = request.pay_results[i] ;
                                                        }
                                                        else {
                                                            // must be a pay money error message from other session. continue processing anyway
                                                            no_pay_error++ ;
                                                            money_transaction.ether_receive_error = request.pay_results[i] ;
                                                            report_error(pgm, ['No money was received from ' + session_info.contact.alias, request.pay_results[i]], {group_debug_seq: group_debug_seq, end_group_operation: false}) ;
                                                        }
                                                    }
                                                    else {
                                                        // is sender. sender is sending money. pay_results[i] must null
                                                        if (request.pay_results[i] != null) {
                                                            error = 'Error. Expected pay_results[' + i + '] to be null. Found ' + request.pay_results[i] ;
                                                            report_error(pgm, error, {group_debug_seq: group_debug_seq}, function () {
                                                                send_w3_cleanup_mt(error) ;
                                                            }) ;
                                                            return ;
                                                        }
                                                    }
                                                }

                                                // open wallet before any get transaction calls
                                                wallet_was_open = (wallet_info.status == 'Open') ;
                                                optional_open_wallet = function (cb) {
                                                    var is_wallet_required, i, money_transaction, error ;
                                                    if (wallet_was_open) return cb() ;
                                                    if (!no_pay_ok) return cb() ;
                                                    // wallet log in is required
                                                    if (etherService.is_login_info_missing(status)) {
                                                        error = ['Money transaction failed', 'Cannot open wallet', 'No wallet log in was found'] ;
                                                        console.log(pgm + 'todo: save received transaction in ls (no_pay_ok>0 or no_pay_error>0)');
                                                        console.log(pgm + 'todo: update file with money transaction status');
                                                        return report_error(pgm, error, {group_debug_seq: group_debug_seq}) ;
                                                    }
                                                    // open wallet
                                                    etherService.openWallet(status, function (error) {
                                                        try {
                                                            if (error && (wallet_info.status != 'Open')) {
                                                                error = ['Money transaction failed', 'Open wallet request failed', error] ;
                                                                console.log(pgm + 'todo: save updated money transaction in ls');
                                                                console.log(pgm + 'todo: update file with money transaction status');
                                                                return report_error(pgm, error, {group_debug_seq: group_debug_seq}) ;
                                                            }
                                                            // continue with send_money and check transaction operations
                                                            cb() ;
                                                        }
                                                        catch (e) {
                                                            error = ['Money transaction failed', 'Open wallet request failed', e.message];
                                                            console.log(pgm + 'todo: save updated money transaction in ls');
                                                            console.log(pgm + 'todo: update file with money transaction status');
                                                            return report_error(pgm, error, {group_debug_seq: group_debug_seq}) ;
                                                        }
                                                    }); // openWallet callback

                                                } ; // optional_open_wallet

                                                optional_close_wallet = function (cb) {
                                                    if (wallet_was_open) return cb() ;
                                                    if (wallet_info.status != 'Open') return cb() ;
                                                    // close wallet
                                                    etherService.close_wallet(function (res) {
                                                        console.log(pgm + 'res = ' + JSON.stringify(res)) ;
                                                        cb() ;
                                                    });
                                                } ; // optional_close_wallet

                                                // start callback sequence (open wallet, check_money, close wallet)
                                                optional_open_wallet(function () {
                                                    var pgm = service + '.process_incoming_message.' + request.msgtype + ' optional_open_wallet callback 3/' + group_debug_seq + ': ';
                                                    var check_money ;

                                                    // send/check money loop (if any Send or check money transactions in money_transactions array)
                                                    check_money = function (i) {
                                                        var pgm, money_transaction, error;
                                                        try {
                                                            pgm = service + '.process_incoming_message.' + request.msgtype + '.check_money/' + group_debug_seq + ': ' ;
                                                            if (i >= session_info.money_transactions.length) {
                                                                console.log(pgm + 'done checking money. ');
                                                                // mark w3_end_mt message as received. do not process again
                                                                session_info.w3_end_mt_received_at = new Date().getTime() ;
                                                                optional_close_wallet(function() {
                                                                    send_w3_cleanup_mt() ;
                                                                }) ;
                                                                return;
                                                            }
                                                            // is sender
                                                            money_transaction = session_info.money_transactions[i];
                                                            if (!money_transaction) console.log(pgm + 'error. session_info.money_transactions.length = ' + session_info.money_transactions.length + ', i = ' + i) ;
                                                            if (money_transaction.code != 'tETH') return check_money(i + 1); // not test Bitcoins
                                                            if (money_transaction.action != 'Request') return check_money(i + 1); // not requesting money
                                                            if (!money_transaction.ether_receive_ok) return check_money(i+1) ; // failed request money operation

                                                            // check ether transactionid
                                                            etherService.get_transaction(money_transaction.ether_receive_ok, function (err, tx) {
                                                                var expected_amount_ether_bn, expected_amount_ether_s, expected_amount_wei_bn, expected_amount_wei_s,
                                                                    received_amount_ether_bn, received_amount_ether_s, received_amount_wei_bn, received_amount_wei_s,
                                                                    error, pgm;
                                                                try {
                                                                    pgm = service + '.process_incoming_message.' + request.msgtype + '.check_money get_transaction callback/' + group_debug_seq + ': ' ;
                                                                    console.log(pgm + 'err = ' + JSON.stringify(err)) ;
                                                                    console.log(pgm + 'tx = ' + JSON.stringify(tx)) ;
                                                                    if (err) {
                                                                        // get transaction failed. maybe API error. maybe invalid transactionid
                                                                        money_transaction.ether_receive_error = 'Receive money failed. Could not verify received ether transaction ' + money_transaction.ether_receive_ok + '. ether error = ' + err ;
                                                                        return check_money(i + 1);
                                                                    }
                                                                    // check tx
                                                                    if (!tx) {
                                                                        money_transaction.ether_receive_error = 'Receive money failed. Could not verify received ether transaction ' + money_transaction.ether_receive_ok + '. tx is null' ;
                                                                        return check_money(i + 1);
                                                                    }
                                                                    if (!tx.value || !tx.value._bn) {
                                                                        money_transaction.ether_receive_error = 'Receive money failed. Could not verify received ether transaction ' + money_transaction.ether_receive_ok + '. tx.value._bn is empty' ;
                                                                        return check_money(i + 1);
                                                                    }
                                                                    // check amount
                                                                    expected_amount_ether_bn = new BigNumber(money_transaction.amount) ;
                                                                    expected_amount_wei_bn = expected_amount_ether_bn.multipliedBy(wei_factor) ;
                                                                    received_amount_wei_s = tx.value.toString(10) ; // tx.value = BN
                                                                    received_amount_wei_bn = new BigNumber(received_amount_wei_s) ;
                                                                    console.log(pgm + 'expected_amount = ' + expected_amount_wei_bn.toString(10) + ', received_amount = ' + received_amount_wei_bn.toString(10)) ;
                                                                    expected_amount_ether_s = bn_toFixed(expected_amount_ether_bn, 18, true) ;
                                                                    expected_amount_wei_s = bn_toFixed(expected_amount_wei_bn, 0, true) ;
                                                                    if (expected_amount_wei_bn.eq(received_amount_wei_bn)) {
                                                                        console.log(pgm + 'Everything is fine. todo: notification in UI.') ;
                                                                        report_error(pgm, [expected_amount_ether_s + ' tETH / ' + expected_amount_wei_s + ' test wei', 'was received from ' + session_info.contact.alias], {type: 'done'}) ; // use new group_debug_seq for notification
                                                                        return check_money(i + 1);
                                                                    }
                                                                    console.log(pgm + 'error: expected amount <> received amount') ;
                                                                    received_amount_ether_bn = received_amount_wei_bn.dividedBy(wei_factor) ;
                                                                    received_amount_ether_s = bn_toFixed(received_amount_ether_bn, 18, true) ;
                                                                    received_amount_wei_s = bn_toFixed(received_amount_wei_bn, 0, true) ;
                                                                    error = [ 'Expected ' + expected_amount_ether_s + ' tETH / ' + expected_amount_wei_s + ' test wei', 'Received ' + received_amount_ether_s + ' tETH / ' + received_amount_wei_s + ' test wei'] ;
                                                                    money_transaction.ether_receive_error = error.join('. ') ;
                                                                    error.splice(1,0, 'from ' + session_info.contact.alias) ;
                                                                    report_error(pgm, error, {type: 'error'}) ; // todo: use new group_debug_seq for notification
                                                                    check_money(i + 1);
                                                                }
                                                                catch (e) {
                                                                    // receive message w3_end_mt failed.
                                                                    if (!e) return ; // exception in MoneyNetworkAPI instance
                                                                    error = e.message ? e.message : e ;
                                                                    console.log(pgm + error);
                                                                    if (e.stack) console.log(e.stack);
                                                                    report_error(pgm, ['Money transaction failed', "JS exception", error], {log: false, group_debug_seq: group_debug_seq}) ;
                                                                    throw(e);
                                                                }
                                                            }) ;
                                                        }
                                                        catch (e) {
                                                            // receive message w3_end_mt failed.
                                                            if (!e) return ; // exception in MoneyNetworkAPI instance
                                                            error = e.message ? e.message : e ;
                                                            console.log(pgm + error);
                                                            if (e.stack) console.log(e.stack);
                                                            report_error(pgm, ['Money transaction failed', "JS exception", error], {log: false, group_debug_seq: group_debug_seq}) ;
                                                            throw(e);
                                                        }
                                                    }; // check_money
                                                    // start check money loop
                                                    check_money(0);
                                                }) ; // optional_open_wallet callback 3
                                            }
                                            catch (e) {
                                                // receive message w3_end_mt failed.
                                                if (!e) return ; // exception in MoneyNetworkAPI instance
                                                error = e.message ? e.message : e ;
                                                console.log(pgm + error);
                                                if (e.stack) console.log(e.stack);
                                                report_error(pgm, ['Money transaction failed', "JS exception", error], {log: false, group_debug_seq: group_debug_seq}) ;
                                                throw(e);
                                            }
                                        }) ; // delete_old_w3_start_mt_msg callback 2
                                    }
                                    catch (e) {
                                        // receive message w3_end_mt failed.
                                        if (!e) return ; // exception in MoneyNetworkAPI instance
                                        error = e.message ? e.message : e ;
                                        console.log(pgm + error);
                                        if (e.stack) console.log(e.stack);
                                        report_error(pgm, ['Money transaction failed', "JS exception", error], {log: false, group_debug_seq: group_debug_seq}) ;
                                        throw(e);
                                    }
                                }) ; // read_w_session callback 1
                            }
                            catch (e) {
                                // receive message w3_end_mt failed.
                                if (!e) return ; // exception in MoneyNetworkAPI instance
                                error = e.message ? e.message : e ;
                                console.log(pgm + error);
                                if (e.stack) console.log(e.stack);
                                report_error(pgm, ['Money transaction failed', "JS exception", error], {log: false, group_debug_seq: group_debug_seq}) ;
                                throw(e);
                            }
                        })() ;
                        return ; // no OK response to offline w3_end_mt
                        // w3_end_mt
                    }
                    else if (request.msgtype == 'w3_cleanup_mt') {
                        // sender to receiver: after w3_end_mt message. cleanup files on user dictionary and session_info
                        //request = {"msgtype":"w3_cleanup_mt"} ;
                        (function w3_cleanup_mt(){
                            var pgm = service + '.process_incoming_message.' + request.msgtype + '/' + group_debug_seq + ': ';
                            try {
                                read_w_session(encrypt2.sessionid, {group_debug_seq: group_debug_seq}, function (session_info)  {
                                    var pgm = service + '.process_incoming_message.' + request.msgtype + ' read_w_session callback 1/' + group_debug_seq + ': ';
                                    try {
                                        var delete_old_w3_end_mt_msg ;

                                        console.log(pgm + 'session_info = ' + JSON.stringify(session_info));
                                        if (!session_info) {
                                            error = ['Money transaction failed', 'w3_cleanup_mt message with unknown sessionid', encrypt2.sessionid];
                                            return report_error(pgm, error, {group_debug_seq: group_debug_seq}) ;
                                        }

                                        if (session_info.w3_cleanup_mt_received_at) {
                                            // ignore. already received. must be a wallet page load. see load_w_sessions
                                            MoneyNetworkAPILib.debug_group_operation_end(group_debug_seq) ;
                                            return ;
                                        }

                                        // 1) must be receiver
                                        if (session_info.sender) {
                                            console.log(pgm + 'warning. is sender of money transaction. ignoring incoming w3_cleanup_mt message. only sent from sender of money transaction to receiver of money transaction');
                                            MoneyNetworkAPILib.debug_group_operation_end(group_debug_seq) ;
                                            return;
                                        }

                                        // cleanup old outgoing files:
                                        // - is "receiver"
                                        // - is receiving w3_cleanup_mt message from "sender"
                                        // - "sender" must have received "w3_end_mt" message from "receiver"
                                        // - find and delete old w3_end_mt message from receiver to sender

                                        console.log(pgm + 'received w3_cleanup_mt. Not sending any msg to other wallet. update transaction status in file system to 6: received w3_cleanup_mt, done');

                                        delete_old_w3_end_mt_msg = function(cb) {
                                            delete_old_msg({session_info: session_info, msg_name: 'w3_end_mt', encrypt: encrypt2, group_debug_seq: group_debug_seq}, cb) ;
                                        } ;
                                        delete_old_w3_end_mt_msg(function() {
                                            var pgm = service + '.process_incoming_message.' + request.msgtype + ' delete_old_w3_end_mt_msg callback 2/' + group_debug_seq + ': ';
                                            var status, options ;
                                            try {
                                                if (request.error) {
                                                    // w3_end_mt check failed. money transaction was aborted by sender of money transaction
                                                    console.log(pgm + 'todo: mark money transaction as aborted in ls');
                                                    console.log(pgm + 'todo: update file with money transaction status');
                                                    return report_error(pgm, error, {group_debug_seq: group_debug_seq}) ;
                                                }
                                                // update money transaction status
                                                status = '6: receive w3_cleanup_mt, done' ;
                                                options = {
                                                    optional: session_info.ip_external ? '-o' : '',
                                                    group_debug_seq: group_debug_seq
                                                } ;
                                                encrypt2.update_wallet_status(status, options, function (res) {
                                                    var pgm = service + '.process_incoming_message.' + request.msgtype + ' update_wallet_status callback 3/' + group_debug_seq + ': ';
                                                    console.log(pgm + 'res = ' + JSON.stringify(res)) ;
                                                    // cleanup
                                                    session_info.w3_cleanup_mt_received_at = new Date().getTime() ;
                                                    session_info.this_status = status ;
                                                    cleanup_session_info(session_info) ;
                                                    save_w_session(session_info, {group_debug_seq: group_debug_seq}, function() {
                                                        MoneyNetworkAPILib.debug_group_operation_end(group_debug_seq) ;
                                                        z_publish({publish: true, reason: request.msgtype});
                                                    }) ;
                                                }) ;

                                            }
                                            catch (e) {
                                                // receive offline message w3_cleanup_mt failed.
                                                if (!e) return ; // exception in MoneyNetworkAPI instance
                                                console.log(pgm + e.message);
                                                console.log(e.stack);
                                                report_error(pgm, ["JS exception", e.message], {log: false, group_debug_seq: group_debug_seq}) ;
                                                throw(e);
                                            }
                                        }) ; // delete_old_w3_end_mt_msg callback 2

                                    }
                                    catch (e) {
                                        // receive offline message w3_cleanup_mt failed.
                                        if (!e) return ; // exception in MoneyNetworkAPI instance
                                        console.log(pgm + e.message);
                                        console.log(e.stack);
                                        report_error(pgm, ["JS exception", e.message], {log: false, group_debug_seq: group_debug_seq}) ;
                                        throw(e);
                                    }

                                }) ; // read_w_session callback 1
                            }
                            catch (e) {
                                // receive offline message w3_cleanup_mt failed.
                                if (!e) return ; // exception in MoneyNetworkAPI instance
                                console.log(pgm + e.message);
                                console.log(e.stack);
                                report_error(pgm, ["JS exception", e.message], {log: false, group_debug_seq: group_debug_seq}) ;
                                throw(e);
                            }
                        })() ;
                        return ; // no OK response to offline w3_cleanup_mt
                        // w3_cleanup_mt
                    }
                    else if (request.msgtype == 'status_mt') {
                        // received money transaction status from other wallet. short text.
                        (function status_mt() {
                            var pgm = service + '.process_incoming_message.' + request.msgtype + '/' + group_debug_seq + ': ';
                            var inner_path ;
                            try {
                                // 1: load session_info
                                read_w_session(encrypt2.sessionid, {group_debug_seq: group_debug_seq}, function (session_info)  {
                                    var pgm = service + '.process_incoming_message.' + request.msgtype + ' read_w_session callback 1/' + group_debug_seq + ': ';
                                    var error ;
                                    if (!session_info) {
                                        error = 'error. could not find session_info for wallet session with sessionid ' + encrypt2.sessionid ;
                                        console.log(pgm + error) ;
                                        MoneyNetworkAPILib.debug_group_operation_end(group_debug_seq, error) ;
                                        return ;
                                    }
                                    session_info.other_status = request.status ;
                                    save_w_session(session_info, {group_debug_seq: group_debug_seq}, function() {
                                        MoneyNetworkAPILib.debug_group_operation_end(group_debug_seq) ;
                                    }) ;
                                }) ; // read_w_session callback 1
                            }
                            catch (e) {
                                // receive message status_mt failed.
                                if (!e) return ; // exception in MoneyNetworkAPI instance
                                console.log(pgm + e.message);
                                console.log(e.stack);
                                report_error(pgm, ["JS exception", e.message], {log: false, group_debug_seq: group_debug_seq}) ;
                                throw(e);
                            }
                        })() ;
                        return ;
                        // status_mt
                    }
                    else if (request.msgtype == 'timeout') {
                        // timeout message from MoneyNetwork. MoneyNetwork sent response after timeout. There may be a timeout failure in W3 session
                        // merge MN process information and wallet process information.
                        MoneyNetworkAPILib.debug_group_operation_receive_stat(encrypt2, request.stat) ;
                    }
                    else if (request.msgtype == 'waiting_for_file') {
                        // timeout for optional fileGet operation in other wallet session
                        // could be issue with using optional files in money transaction and ZeroNet port closed.
                        // ip_external returned in serverInfo maybe old and wrong.
                        // workaround is to change missing optional file to a normal file and publish
                        (function waiting_for_file(){
                            var pgm = service + '.process_incoming_message.' + request.msgtype + '/' + group_debug_seq + ': ';
                            var inner_path ;
                            try {
                                // 1: load session_info
                                read_w_session(encrypt2.sessionid, {group_debug_seq: group_debug_seq}, function (session_info)  {
                                    var pgm = service + '.process_incoming_message.' + request.msgtype + ' read_w_session callback 1/' + group_debug_seq + ': ';
                                    var error ;
                                    if (!session_info) {
                                        error = 'error. could not find session_info for wallet session with sessionid ' + encrypt2.sessionid ;
                                        console.log(pgm + error) ;
                                        MoneyNetworkAPILib.debug_group_operation_end(group_debug_seq, error) ;
                                        return ;
                                    }
                                    // check files
                                    if (!session_info.files) session_info.files = {} ;
                                    if (!session_info.files[request.filename]) {
                                        console.log(pgm + 'warning. ' + request.filename + ' is not in files. Maybe a w3_cleanup_mt message?') ;
                                        console.log(pgm + 'files = ' + JSON.stringify(session_info.files)) ;
                                    }
                                    try {
                                        // 2: read old file
                                        inner_path = encrypt2.this_user_path + request.filename ;
                                        z_file_get(pgm, {inner_path: inner_path, group_debug_seq: group_debug_seq}, function (json_str, extra) {
                                            var pgm = service + '.process_incoming_message.' + request.msgtype + ' z_file_get callback 2/' + group_debug_seq + ': ';
                                            var error, json, re ;
                                            try {
                                                if (!json_str) {
                                                    // OK. file deleted by W3 cleanup utility after page reload.
                                                    error = 'ignoring waiting_for_file message. could not find ' + inner_path ;
                                                    console.log(pgm + error) ;
                                                    MoneyNetworkAPILib.debug_group_operation_end(group_debug_seq, error) ;
                                                    return ;
                                                }
                                                re = /^[0-9a-f]{10}(-e|-o)?\.[0-9]{13}$/ ;
                                                if (!request.filename.match(re)) {
                                                    error = 'error. waiting_for_file message should only be used for -e (external) and -o (offline) optional files' ;
                                                    console.log(pgm + error) ;
                                                    MoneyNetworkAPILib.debug_group_operation_end(group_debug_seq, error) ;
                                                    return ;
                                                }
                                                // 3: delete old file
                                                MoneyNetworkAPILib.z_file_delete(pgm, inner_path, function (res) {
                                                    var pgm = service + '.process_incoming_message.' + request.msgtype + ' z_file_delete callback 3/' + group_debug_seq + ': ';
                                                    var new_filename, new_inner_path, old_request ;
                                                    try {
                                                        console.log(pgm + 'res = ' + JSON.stringify(res)) ;
                                                        if (res != 'ok') {
                                                            error = 'error. could not delete ' + inner_path + '. res = ' + JSON.stringify(res) ;
                                                            console.log(pgm + error) ;
                                                            MoneyNetworkAPILib.debug_group_operation_end(group_debug_seq, error) ;
                                                            return ;
                                                        }
                                                        if (!session_info.files) session_info.files = {} ;
                                                        old_request = session_info.files[request.filename] ;
                                                        delete session_info.files[request.filename] ;
                                                        if (!ls.w_files) ls.w_files = {} ;
                                                        delete ls.w_files[request.filename] ;

                                                        // 4: write new file
                                                        new_filename = request.filename.substr(0,10) + '.' + request.filename.substr(-13) ;
                                                        new_inner_path = encrypt2.this_user_path + new_filename ;
                                                        // json_raw = unescape(encodeURIComponent(JSON.stringify(json, null, "\t")));
                                                        z_file_write(pgm, new_inner_path, btoa(json_str), {group_debug_seq: group_debug_seq}, function (res) {
                                                            var pgm = service + '.process_incoming_message.' + request.msgtype + ' z_file_write callback 4/' + group_debug_seq + ': ';
                                                            try {
                                                                console.log(pgm + 'res = ' + JSON.stringify(res)) ;
                                                                if (res != 'ok') {
                                                                    error = 'error. could not write ' + new_inner_path + '. res = ' + JSON.stringify(res) ;
                                                                    console.log(pgm + error) ;
                                                                    MoneyNetworkAPILib.debug_group_operation_end(group_debug_seq, error) ;
                                                                    if (old_request) save_w_session(session_info) ;
                                                                    return ;
                                                                }
                                                                if (old_request) session_info.files[new_filename] = old_request ;
                                                                if (!ls.w_files) ls.w_files = {} ;
                                                                ls.w_files[new_filename] = true ;
                                                                // publish change from optional to normal file.
                                                                // other session should be able to read normal file.

                                                                // 5: save session info
                                                                MoneyNetworkAPILib.debug_group_operation_end(group_debug_seq) ;
                                                                if (old_request) {
                                                                    save_w_session(session_info, {group_debug_seq: group_debug_seq}, function() { // xxx
                                                                        z_publish({publish: true, reason: new_filename}) ;
                                                                    })
                                                                }
                                                                else z_publish({publish: true, reason: new_filename})
                                                            }
                                                            catch (e) {
                                                                // receive message waiting_for_file failed.
                                                                if (!e) return ; // exception in MoneyNetworkAPI instance
                                                                console.log(pgm + e.message);
                                                                console.log(e.stack);
                                                                report_error(pgm, ["JS exception", e.message], {log: false, group_debug_seq: group_debug_seq}) ;
                                                                throw(e);
                                                            }
                                                        }) ; // z_file_write callback 4
                                                    }
                                                    catch (e) {
                                                        // receive message waiting_for_file failed.
                                                        if (!e) return ; // exception in MoneyNetworkAPI instance
                                                        console.log(pgm + e.message);
                                                        console.log(e.stack);
                                                        report_error(pgm, ["JS exception", e.message], {log: false, group_debug_seq: group_debug_seq}) ;
                                                        throw(e);
                                                    }
                                                }) ; // z_file_delete callback 3
                                            }
                                            catch (e) {
                                                // receive message waiting_for_file failed.
                                                if (!e) return ; // exception in MoneyNetworkAPI instance
                                                console.log(pgm + e.message);
                                                console.log(e.stack);
                                                report_error(pgm, ["JS exception", e.message], {log: false, group_debug_seq: group_debug_seq}) ;
                                                throw(e);
                                            }
                                        }) ; // z_file_get callback 2
                                    }
                                    catch (e) {
                                        // receive message waiting_for_file failed.
                                        if (!e) return ; // exception in MoneyNetworkAPI instance
                                        console.log(pgm + e.message);
                                        console.log(e.stack);
                                        report_error(pgm, ["JS exception", e.message], {log: false, group_debug_seq: group_debug_seq}) ;
                                        throw(e);
                                    }
                                }) ; // read_w_session callback 1
                            }
                            catch (e) {
                                // receive message waiting_for_file failed.
                                if (!e) return ; // exception in MoneyNetworkAPI instance
                                console.log(pgm + e.message);
                                console.log(e.stack);
                                report_error(pgm, ["JS exception", e.message], {log: false, group_debug_seq: group_debug_seq}) ;
                                throw(e);
                            }
                        })() ;
                        return ;
                        // waiting_for_file
                    }
                    else response.error = 'Unknown msgtype ' + request.msgtype;
                    console.log(pgm + 'response = ' + JSON.stringify(response));

                    send_response();


                } // try
                catch (e) {
                    console.log(pgm + e.message);
                    console.log(e.stack);
                    throw(e);
                } // catch

            } // process_incoming_message
            MoneyNetworkAPILib.config({cb: process_incoming_message, cb_fileget: true, cb_decrypt: true}) ;

            // encrypt2 - encrypt messages between MN and W3
            // todo: reset encrypt1 and encrypt2 when cert_user_id is set or changed
            var encrypt2 = new MoneyNetworkAPI({
                debug: 'encrypt2'
            }) ;
            var new_sessionid; // temporary save sessionid received from MN
            var sessionid ; // unique sessionid. also like a password known only by MN and W3 session
            var this_pubkey ;            // W3 JSEncrypt public key used by MN
            var this_pubkey2 ;           // W3 cryptMessage public key used by MN

            // session is saved in localStorage and session information is encrypted with a session password
            // session password = pwd1+pwd2
            // pwd1 is saved in W3 localStorage and cryptMessage encrypted
            // pwd2 is saved in MN localStorage and is symmetric encrypted with pwd1
            // session password is not saved on ZeroNet and is not shared with other users on ZeroNet
            // session can be restored with ZeroNet cert + MN login
            var session_pwd1, session_pwd2 ;

            // read first 'pubkeys' message from MN session
            // optional file with file format <other_session_filename>.<timestamp>
            // pubkey used by JSEncrypt (client) and pubkey2 used by cryptMessage (ZeroNet)
            function read_pubkeys (cb) {
                var pgm = service + '.read_pubkeys: ' ;
                var group_debug_seq ;
                if (!cb) cb = function() {} ;

                group_debug_seq = MoneyNetworkAPILib.debug_group_operation_start() ;
                MoneyNetworkAPILib.debug_group_operation_update(group_debug_seq, {msgtype: 'pubkeys'}) ;
                encrypt2.get_session_filenames({group_debug_seq: group_debug_seq}, function (this_session_filename, other_session_filename, unlock_pwd2) {
                    var pgm = service + '.read_pubkeys get_session_filenames callback 1: ' ;
                    var pgm2, w3_query_4, debug_seq ;
                    pgm2 = MoneyNetworkAPILib.get_group_debug_seq_pgm(pgm, group_debug_seq) ;
                    console.log(pgm2 + 'this_session_filename = ' + this_session_filename + ', other_session_filename = ' + other_session_filename) ;
                    w3_query_4 =
                        "select " +
                        "  json.directory," +
                        "  substr(json.directory, 1, instr(json.directory,'/')-1) as hub," +
                        "  substr(json.directory, instr(json.directory,'/data/users/')+12) as auth_address," +
                        "  files_optional.filename, keyvalue.value as modified " +
                        "from files_optional, json, keyvalue " +
                        "where files_optional.filename like '" + other_session_filename + "-i.%' " +
                        "and json.json_id = files_optional.json_id " +
                        "and keyvalue.json_id = json.json_id " +
                        "and keyvalue.key = 'modified' " +
                        "order by files_optional.filename desc" ;
                    console.log(pgm2 + 'w3 query 4 = ' + w3_query_4) ;
                    debug_seq = MoneyNetworkAPILib.debug_z_api_operation_start(pgm, 'w3 query 4', 'dbQuery', null, group_debug_seq) ;
                    ZeroFrame.cmd("dbQuery", [w3_query_4], function (res) {
                        var pgm = service + '.read_pubkeys dbQuery callback 2: ' ;
                        var pgm2, prefix, other_user_path, inner_path, re, i ;
                        MoneyNetworkAPILib.debug_z_api_operation_end(debug_seq, (!res || res.error) ? 'Failed. error = ' + JSON.stringify(res) : 'OK. Returned ' + res.length + ' rows');
                        pgm2 = MoneyNetworkAPILib.get_group_debug_seq_pgm(pgm, group_debug_seq) ;
                        prefix = "Error. MN-W3 session handshake failed. " ;
                        // console.log(pgm + 'res = ' + JSON.stringify(res)) ;
                        if (!res || res.error) {
                            console.log(pgm2 + prefix + 'cannot read pubkeys message. dbQuery failed with ' + JSON.stringify(res)) ;
                            console.log(pgm2 + 'w3 query 4 = ' + w3_query_4) ;
                            status.sessionid = null ;
                            MoneyNetworkAPILib.debug_group_operation_end(group_debug_seq, JSON.stringify(res)) ;
                            return cb(status.sessionid) ;
                        }
                        // check optional filename. pubkeys message from mn is an -i (internal) optional file
                        re = /^[0-9a-f]{10}-i\.[0-9]{13}$/ ;
                        console.log(pgm2 + 'old res.length = ' + res.length) ;
                        for (i=res.length-1 ; i >= 0 ; i--) {
                            if (!res[i].filename.match(re)) res.splice(i,1) ;
                        }
                        console.log(pgm2 + 'new res.length = ' + res.length) ;
                        if (res.length == 0) {
                            console.log(pgm2 + prefix + 'pubkeys message was not found') ;
                            console.log(pgm2 + 'w3 query 4 = ' + w3_query_4) ;
                            status.sessionid = null ;
                            MoneyNetworkAPILib.debug_group_operation_end(group_debug_seq, 'pubkeys message was not found (dbQuery)') ;
                            return cb(status.sessionid) ;
                        }

                        // mark file as read. generic process_incoming_message will not process this file
                        MoneyNetworkAPILib.wait_for_file(res[0].filename) ;

                        // first message. remember path to other session user directory. all following messages must come from same user directory
                        other_user_path = 'merged-' + get_merged_type() + '/' + res[0].directory + '/' ;
                        encrypt2.setup_encryption({other_user_path: other_user_path}) ;

                        // read file
                        inner_path = other_user_path + res[0].filename ;
                        // console.log(pgm +  inner_path + ' z_file_get start') ;
                        z_file_get(pgm, {inner_path: inner_path, required: true, group_debug_seq: group_debug_seq}, function (pubkeys_str) {
                            var pgm = service + '.read_pubkeys z_file_get callback 3: ' ;
                            var pgm2, pubkeys, now, content_signed, elapsed, error ;
                            pgm2 = MoneyNetworkAPILib.get_group_debug_seq_pgm(pgm, group_debug_seq) ;
                            // console.log(pgm + 'pubkeys_str = ' + pubkeys_str) ;
                            if (!pubkeys_str) {
                                console.log(pgm2 + prefix + 'read pubkeys failed. file + ' + inner_path + ' was not found') ;
                                status.sessionid = null ;
                                MoneyNetworkAPILib.debug_group_operation_end(group_debug_seq, 'pubkeys message was not found (fileGet)') ;
                                return cb(status.sessionid) ;
                            }
                            // check pubkeys message timestamps. must not be old or > now.
                            now = Math.floor(new Date().getTime()/1000) ;
                            content_signed = res[0].modified ;
                            // file_timestamp = Math.floor(parseInt(res[0].filename.substr(11))/1000) ;
                            elapsed = now - content_signed ;
                            if (elapsed < 0) {
                                console.log(pgm2 + prefix + 'read pubkeys failed. file + ' + inner_path + ' signed in the future. elapsed = ' + elapsed) ;
                                status.sessionid = null ;
                                MoneyNetworkAPILib.debug_group_operation_end(group_debug_seq, 'pubkeys message signed in the future') ;
                                return cb(status.sessionid) ;
                            }
                            if (elapsed > 60) {
                                console.log(pgm2 + prefix + 'read pubkeys failed. file + ' + inner_path + ' is too old. elapsed = ' + elapsed) ;
                                MoneyNetworkAPILib.debug_group_operation_end(group_debug_seq, 'pubkeys message is old') ;
                                status.sessionid = null ;
                                return cb(status.sessionid) ;
                            }
                            // console.log(pgm2 + 'timestamps: file_timestamp = ' + file_timestamp + ', content_signed = ' + content_signed + ', now = ' + now) ;
                            try {
                                pubkeys = JSON.parse(pubkeys_str) ;
                            }
                            catch (e) {
                                console.log(pgm2 + prefix + 'read pubkeys failed. file + ' + inner_path + ' is invalid. pubkeys_str = ' + pubkeys_str + ', error = ' + e.message) ;
                                status.sessionid = null ;
                                MoneyNetworkAPILib.debug_group_operation_end(group_debug_seq, 'pubkeys message is invalid. ' + e.message) ;
                                return cb(status.sessionid) ;
                            }
                            error = MoneyNetworkAPILib.validate_json(pgm, pubkeys) ;
                            if (error) {
                                console.log(pgm2 + prefix + 'invalid pubkeys message. error = ' + error) ;
                                status.sessionid = null ;
                                MoneyNetworkAPILib.debug_group_operation_end(group_debug_seq, 'pubkeys message is invalid. ' + error) ;
                                return cb(status.sessionid) ;
                            }
                            if (pubkeys.msgtype != 'pubkeys') {
                                console.log(pgm2 + prefix + 'First message from MN was NOT a pubkeys message. message = ' + JSON.stringify(pubkeys) );
                                status.sessionid = null ;
                                MoneyNetworkAPILib.debug_group_operation_end(group_debug_seq, 'not a pubkey message. msgtype = ' + JSON.stringify(pubkeys.msgtype)) ;
                                return cb(status.sessionid);
                            }
                            console.log(pgm2 + 'OK. received public keys from MN') ;
                            console.log(pgm2 + 'MN public keys: pubkey2 = ' + pubkeys.pubkey2 + ', pubkey = ' + pubkeys.pubkey) ;
                            encrypt2.setup_encryption({pubkey: pubkeys.pubkey, pubkey2: pubkeys.pubkey2}) ;
                            // mark file as read.

                            // return W3 public keys to MN session for full end2end encryption between the 2 sessions
                            console.log(pgm + 'Return W3 public keys to MN for full end-2-end encryption') ;
                            write_pubkeys(group_debug_seq, cb) ;

                        }) ; // z_file_get callback 3

                    }) ; // dbQuery callback 2


                }) ; // get_session_filenames callback 1

            } // read_pubkeys

            // get public key for JSEncrypt
            function get_my_pubkey () {
                var crypt, prvkey ;
                if (this_pubkey) return this_pubkey ;
                // generate key pair for client to client RSA encryption
                crypt = new JSEncrypt({default_key_size: 1024});
                crypt.getKey();
                this_pubkey = crypt.getPublicKey();
                prvkey = crypt.getPrivateKey();
                // save JSEncrypt private key for decrypt_1
                encrypt2.setup_encryption({prvkey: prvkey}) ;
                return this_pubkey ;
            } // get_my_pubkey

            // get public key for cryptMessage
            var get_my_pubkey2_cbs = [] ; // callbacks waiting for get_my_pubkey2 request
            function get_my_pubkey2 (cb) {
                var pgm = service + '.get_my_pubkey2: ' ;
                var debug_seq ;
                if (this_pubkey2 == true) { get_my_pubkey2_cbs.push(cb) ; return } // wait
                if (this_pubkey2) return cb(this_pubkey2) ; // ready
                // get pubkey2
                this_pubkey2 = true ;
                debug_seq = MoneyNetworkAPILib.debug_z_api_operation_start(pgm, null, 'userPublickey') ;
                ZeroFrame.cmd("userPublickey", [0], function (my_pubkey2) {
                    var pgm = service + '.get_my_pubkey2 userPublickey callback: ' ;
                    MoneyNetworkAPILib.debug_z_api_operation_end(debug_seq, my_pubkey2 ? 'OK' : 'Failed. Not found');
                    this_pubkey2 = my_pubkey2 ;
                    console.log(pgm + 'encrypt1. setting pubkey2 = ' + my_pubkey2) ;
                    encrypt1.setup_encryption({pubkey2: my_pubkey2}) ;
                    cb(this_pubkey2) ;
                    while (get_my_pubkey2_cbs.length) { cb = get_my_pubkey2_cbs.shift() ; cb(this_pubkey2) }
                }) ;
            } // get_my_pubkey2

            // pubkeys message from W3 to MN. public keys + a session password
            function write_pubkeys(group_debug_seq, cb) {
                var pgm = service + '.write_pubkeys: ' ;
                if (!cb) cb = function() {} ;
                // collect info before returning W3 public keys information to MN session
                get_user_path(function (user_path) {
                    var my_pubkey = get_my_pubkey() ;
                    get_my_pubkey2(function (my_pubkey2) {
                        encrypt2.add_optional_files_support({group_debug_seq: group_debug_seq}, function() {
                            var pgm = service + '.write_pubkeys get_my_pubkey2 callback 3: ' ;
                            var pgm2, request, encrypted_pwd2 ;
                            pgm2 = MoneyNetworkAPILib.get_group_debug_seq_pgm(pgm, group_debug_seq) ;
                            // W3 password
                            // - pwd1: cryptMessage encryped and saved in W3 localStorage
                            // - pwd2: encrypted with pwd1 and saved in MN.
                            session_pwd1 = generate_random_string(50, true) ;
                            session_pwd2 = generate_random_string(50, true) ;
                            encrypted_pwd2 = MoneyNetworkAPILib.aes_encrypt(session_pwd2, session_pwd1) ;
                            request = {
                                msgtype: 'pubkeys',
                                pubkey: my_pubkey, // for JSEncrypt
                                pubkey2: my_pubkey2, // for cryptMessage
                                password: encrypted_pwd2 // for session restore
                            } ;
                            console.log(pgm + 'request = ' + JSON.stringify(request)) ;
                            // timeout in wallet test6 is 60 seconds. expire send pubkeys message in 60 seconds
                            encrypt2.send_message(request, {response: 60000, msgtype: 'pubkeys', group_debug_seq: group_debug_seq}, function (response) {
                                var pgm = service + '.write_pubkeys send_message callback 4: ' ;
                                var pgm2 ;
                                pgm2 = MoneyNetworkAPILib.get_group_debug_seq_pgm(pgm, group_debug_seq) ;
                                console.log(pgm2 + 'response = ' + JSON.stringify(response)) ;
                                if (!response.error) {
                                    // session handshake ok. save session
                                    save_mn_session(function() {cb(true) }) ;
                                    MoneyNetworkAPILib.debug_group_operation_end(group_debug_seq) ;
                                }
                                else {
                                    MoneyNetworkAPILib.debug_group_operation_end(group_debug_seq, 'write pubkeys failed. res = ' + JSON.stringify(response)) ;
                                    cb(false) ;
                                }
                            }) ; // send_message callback 4

                        }) ; // add_optional_files_support callback 3

                    }) ; // get_my_pubkey2 callback 2

                }) ; // get_user_path callback 1

            } // write_pubkeys

            // save MN session in W3 localStorage
            // - unencrypted:
            //   - W3 pubkey and W3 pubkey2
            //   - MN pubkey and MN pubkey2
            // - encrypted with cryptMessage (ZeroId)
            //   - session_pwd1, unlock_pwd2, this_session_filename, other_session_filename
            // - encrypted with session password
            //   - W3 prvkey
            //   - sessionid
            function save_mn_session(cb) {
                var pgm = service + '.save_mn_session: ' ;
                var array ;
                if (!cb) cb = function() {} ;
                console.log(pgm + 'saving MN session. status.sessionid = ' + status.sessionid + ', encrypt2.sessionid = ' + encrypt2.sessionid) ;
                encrypt2.get_session_filenames({}, function (this_session_filename, other_session_filename, unlock_pwd2) {
                    var pgm = service + '.save_mn_session get_session_filenames callback 1: ' ;
                    console.log(pgm + 'saving MN session. status.sessionid = ' + status.sessionid + ', encrypt2.sessionid = ' + encrypt2.sessionid) ;
                    // cryptMessage encrypt session_pwd1, this_session_filename and other_session_filename
                    array = [ session_pwd1, unlock_pwd2, this_session_filename, other_session_filename] ;
                    encrypt1.encrypt_2(JSON.stringify(array), {}, function(encrypted_info) {
                        var pgm = service + '.save_mn_session encrypt_2 callback 2: ' ;
                        var auth_address, info, prvkey, password ;
                        console.log(pgm + 'saving MN session. status.sessionid = ' + status.sessionid + ', encrypt2.sessionid = ' + encrypt2.sessionid) ;
                        if (!ls.mn_sessions) ls.mn_sessions = {} ;
                        auth_address = ZeroFrame.site_info.auth_address ;
                        if (!ls.mn_sessions[auth_address]) ls.mn_sessions[auth_address] = {} ;
                        info = ls.mn_sessions[auth_address] ; // sessions = MN sessions. One for each auth_address
                        info.this_pubkey = this_pubkey ; // W3 (clear text)
                        info.this_pubkey2 = this_pubkey2 ; // W3 (clear text)
                        info.other_pubkey = encrypt2.other_session_pubkey ; // MN (clear text)
                        info.other_pubkey2 = encrypt2.other_session_pubkey2 ; // MN (clear text)
                        info.encrypted_info = encrypted_info ; // W3 (cryptMessage). pwd1, unlock_pwd2, this_session_filename and other_session_filename
                        prvkey = encrypt2.this_session_prvkey ;
                        password = session_pwd1 + session_pwd2 ;
                        info.prvkey = MoneyNetworkAPILib.aes_encrypt(prvkey, password) ; // W3 (symmetric encrypted)
                        info.sessionid = MoneyNetworkAPILib.aes_encrypt(status.sessionid, password); // MN+W3 (symmetric encrypted)
                        console.log(pgm + 'info = ' + JSON.stringify(info)) ;
                        //info = {
                        //    "this_pubkey": "-----BEGIN PUBLIC KEY-----\nMIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQCZ6pQlnMMT/03KRipfc9/poCZl\nWq9nGpRrzfh5xJEuGkRPluTt4m92NJ6zqutZN4cxMPcfSuogoyqcG8ahb9I8VUXS\nslNDMNmpdk6WRI+ows0CtWJ3qGSJbTKMUAyoFE6plMJ6dCXH85vjLCocsUhEcSVb\nitUlnwGRL/sj7d5GyQIDAQAB\n-----END PUBLIC KEY-----",
                        //    "this_pubkey2": "Ahn94vCUvT+S/nefej83M02n/hP8Jvqc8KbxMtdSsT8R",
                        //    "other_pubkey": "-----BEGIN PUBLIC KEY-----\nMIIBITANBgkqhkiG9w0BAQEFAAOCAQ4AMIIBCQKCAQBpQDut223gZcYfGTHxqoal\nDFX4PvQY1riWEPVqiO2eXS3E47XJjRUtMSUqzpb011ZxzauTxSXlTL1uunIykTvN\nmsXaNSq/tPIue0zdVSCN4PrJo5FY5P6SYGviZBLzdHZJYqlNk3QPngrBGJl/VBBp\nToPXmN7hog/9rXEGhPyN7GX2AKy3pPFCkXFC9GDlCoEjt0Pq+y5sF/t4iPXyn878\nirWfYbRPisLjnJGqSe23/c6MhP8CTvnbFvpiBcLES7HQk6hqqBBnLe9NLTABbqXK\n6i1LW6+aZRqOX72mMwU+1LTcbQRIW1nG6rtPhaUqiIzeH0g8B743bjmcJagm1foH\nAgMBAAE=\n-----END PUBLIC KEY-----",
                        //    "other_pubkey2": "A4RQ77ia8qK1b3FW/ERL2HdW33jwCyKqxRwKQLzMw/yu",
                        //    "pwd1": "[\"n136va4JjXjbYBGapT8FewLKACA5iCNxNFEg6qmUn7/uydqYOqkCKhcSYkpXFpdd3E7rZgAgoSy20bnoNwIruK/JHRapPz24tWrYv516Cl9hC778IWZFTyU0Rhl21axGIgLAvcFkIKq2cT4OgzYuTt4y5YTqw3JKJUzTK9F5CHLtzgJyyOwcx0VNDRGOcZ1usPx8MlSi95f3sMnBcIAtY8IvNSFvsg==\",\"GH2vevBGncKvjRWqNIRp/A==\",\"gWXNAfcHe1VX+viCiOaqSiUMUoWN4GPi///8nEYCMd3ktZwejzoHNJFV+LskTU4Aw/tmYhj1FOZhoNPBxv0jtg==\"]",
                        //    "prvkey": "U2FsdGVkX195BEgVCqqpVaZ32sZzEBXodkFpz8d436nANHPmCwnyBUAO+t8HLfaNxEtLGBzC5RzQvo8vXwopfz4gO3CoXUdni/0Y1dhXoXKX/OZ5WeDSooJDbOD7XZJQP13qsGdX5cZuR96sMfO546uJ5y8olDW8dZVxrjw6kV0hzbv3rEn3vvLzNwRw5iN+ULtbgRfYzA/3EJ2DDdlzJTVab24th3Qw1DAlEHAoSKKt232OXDOkfSgylFFbWLPrJHOlZ+4broX/w195MkNxAsPvoDKYMr485om7nSifPR2nHMvsMGwueiJTHfcmCwYQ0HFguhViwI/aznw2T+PnqV4nbSKZILoLXlspOoWLBbL1vf6nJa1NE/wfUoWHIZkqccCBiimPc1LbaIy6I539AbRNV9WJSDAdI+TGosFxuvcjZ22jL9nHARCxdW0boQhF+BI5X1mP/LmHwS1d3BSXpLrHlc1kmHqvA5Bl0C2QlpA9b46FyB5yKxPCZKyrLPTMo+KsIAYUPGCo/RV5JlE73s53izY7aSZsXkiLu17p9zFFQXdwIY8ZggY40ZvkJQ3f6gtw1nuU2eT/zhHG+ao62uBziFnVBN/kU4KoIkAeGOKMEgjGvAeliaQ2C2qU0YKOY6gdJGo+bbVepnzBNvcrjkUOQLU7SkQWOe9Nn8TNJ/3VCs+ubGXkL/ItKcHQB3KkILVr///eSXzc1AxJxspv8mQp9Zi0GDk/EcjSIsb61AHTKJXV5SkBmDHDDJHBZ92wUSGnqCQ6dPsvcUt/9YoHjlvlfb++HeYDwixWiQoZssSp4viNrVEhWrHIE3jVGrXKcr4Ojf6HNMaKszHafKSL2weCpApz20l1xu9V9iPXKXk82HNUEaK6BnzjwaCXwFqufEaYkMk+bhu+/FC4trJwIIC//XbH0Aw0ED0QXInghAlW/jv7QBCDKuzhEMFKyQJHAscNLMrVP7cjIrpLeMY1KV2RLNpp0bvCtC7L4q++rkYF5YPqjBMBF0yuOJVk0/1hvzL/d6uClublDAhlR3Tk8gQbcvlVKfXiEUqXt4EnE6N6gv+SyITM9FGVH55CJQcAEcirCLpI7LsUB4xEXYsb3E1jvvEI5OOxsNGEEFiyXoQYIiokH/I/1hiaVXmsBYcjK0eKrRil16EcphoOu+eRpGGurkWEEQI8laIsjKrqUzUm4zesxfzgmBhhlUd3TsIp",
                        //    "sessionid": "U2FsdGVkX1/0a09r+5JZgesSVAoaN7d/jrGpc4x3mhHfQY83Rewr5yMnU2awz9Emru2y69CPpZyYTQh/G/20TPyqua02waHlzATaChw5xYY="
                        //};
                        ls_save() ;
                        cb() ;
                    }) ; // encrypt_2 callback 2

                }) ; // get_session_filenames callback 1

            } // save_mn_session

            // w3 startup 1: check and save any sessionid param and redirect without sessionid in URL
            function is_sessionid() {
                var pgm = service + '.is_sessionid: ' ;
                var sessionid, a_path, z_path ;
                sessionid = $location.search()['sessionid'] ;
                if (!sessionid) return false ; // no sessionid in url
                // new sessionid received from MN. save and redirect without sessionid
                new_sessionid = sessionid ;
                console.log(pgm + 'initialize step 1: new_sessionid = ' + new_sessionid + ' was received from MN') ;
                status.session_handshake = 'Received sessionid from MN' ;
                // redirect
                a_path = '/wallet' ;
                z_path = "?path=" + a_path ;
                $location.path(a_path).search({sessionid:null}) ;
                $location.replace();
                ZeroFrame.cmd("wrapperReplaceState", [{"scrollY": 100}, "Money Network W3", z_path]) ;
                return true;
            } // is_sessionid

            // w3 startup 2: check merger permission. required for most ZeroFrame operations
            function check_merger_permission(cb) {
                var pgm = service + '.check_merger_permission: ';
                var request1, request2, retry_check_merger_permission, debug_seq ;
                if (!cb) cb = function () {};
                request1 = function (cb) {
                    var pgm = service + '.check_merger_permission.request1: ';
                    var debug_seq ;
                    ZeroFrame.cmd("wrapperPermissionAdd", "Merger:MoneyNetwork", function (res) {
                        console.log(pgm + 'res = ', JSON.stringify(res));
                        if (res == "Granted") {
                            status.merger_permission = 'Granted';
                            request2(cb);
                        }
                        else cb(false);
                    });
                }; // request1
                request2 = function (cb) {
                    var pgm = service + '.check_merger_permission.request2: ';
                    get_my_wallet_hub(function (hub, other_wallet_data_hub, other_wallet_data_hub_title) {
                        // everything should be OK. get_my_wallet_hub checks and adds missing wallet data hubs
                        cb(true) ;
                    });
                }; // request2

                // wait for ZeroFrame.site_info to be ready
                retry_check_merger_permission = function () {
                    check_merger_permission(cb)
                };
                if (!ZeroFrame.site_info) {
                    $timeout(retry_check_merger_permission, 500);
                    return;
                }
                // if (!ZeroFrame.site_info.cert_user_id) return cb(false); // not logged in

                // console.log(pgm , 'site_info = ' + JSON.stringify(site_info)) ;
                if (ZeroFrame.site_info.settings.permissions.indexOf("Merger:MoneyNetwork") == -1) {
                    status.merger_permission = 'Missing';
                    return request1(cb);
                }
                status.merger_permission = 'Granted';
                debug_seq = MoneyNetworkAPILib.debug_z_api_operation_start(pgm, null, 'mergerSiteList') ;
                ZeroFrame.cmd("mergerSiteList", {}, function (merger_sites) {
                    var pgm = service + '.check_merger_permission mergerSiteList callback 2: ';
                    MoneyNetworkAPILib.debug_z_api_operation_end(debug_seq, merger_sites ? 'OK' : 'Error. Not found') ;
                    console.log(pgm + 'merger_sites = ', JSON.stringify(merger_sites));
                    get_my_wallet_hub(function (hub, other_wallet_data_hub, other_wallet_data_hub_title) {
                        if (merger_sites[hub] == "MoneyNetwork") cb(true);
                        else request2(cb);
                    });
                }); // mergerSiteList callback 2
            } // check_merger_permission

            // w3 startup 3: check cert_user_id. Must be present

            // w3 startup 4: update wallet.json

            // w3 startup 5: check old session. restore from localStorage and password from MN
            function is_old_session (cb) {
                var pgm = service + '.is_old_session: ' ;
                var auth_address, info, encrypted_session_pwd1 ;
                if (!ls.mn_sessions) {
                    console.log(pgm + 'no old sesions found in ls. ls = ' + JSON.stringify(ls)) ;
                    return cb() ;
                } // no saved sessions
                if (!ZeroFrame.site_info) {
                    console.log(pgm + 'invalid call. ZeroFrame is still loading') ;
                    return cb() ;
                }
                if (!ZeroFrame.site_info.cert_user_id) {
                    console.log(pgm + 'invalid call. ZeroId not selected. Cert_user_id is null') ;
                    return cb() ;
                }
                auth_address = ZeroFrame.site_info.auth_address ;
                info = ls.mn_sessions[auth_address] ;
                if (!info) {
                    console.log(pgm + 'no old session was found for ' + auth_address) ;
                    return cb() ;
                }
                if (!info.encrypted_info) {
                    console.log(pgm + 'error in saved session for ' + auth_address + '. no encrypted_info. info = ' + JSON.stringify(info)) ;
                    delete ls.mn_sessions[auth_address] ;
                    ls_save() ;
                    return cb() ;
                }

                // ready for session info decrypt and get_password request
                get_user_path(function (user_path) {
                    var pgm = service + '.is_old_session get_user_path callback 1: ' ;
                    status.session_handshake = 'Checking old session' ;
                    // decrypt pwd1, this_session_filename and other_session_filename
                    console.log(pgm + 'found old session. cryptMessage decrypting "info.encrypted_info"') ;
                    encrypt1.decrypt_2(info.encrypted_info, {}, function(decrypted_info) {
                        var pgm = service + '.is_old_session decrypt_2 callback 2: ' ;
                        var array_names, array, i, temp_pwd1, request ;
                        array_names = ['session_pwd1', 'unlock_pwd2', 'this_session_filename', 'other_session_filename'] ;
                        try {
                            array = JSON.parse(decrypted_info) ; // [ session_pwd1, unlock_pwd2, this_session_filename, other_session_filename]
                        }
                        catch (e) {
                            console.log(pgm + 'error in saved session for ' + auth_address + '. Expected json string. decrypted_info = ' + decrypted_info + '. error = ' + e.message) ;
                            delete ls.mn_sessions[auth_address] ;
                            ls_save() ;
                            return cb() ;
                        }
                        if (!Array.isArray(array)) {
                            console.log(pgm + 'error in saved session for ' + auth_address + '. Expected array. found ' + (typeof array) + '. decrypted_info = ' + decrypted_info) ;
                            delete ls.mn_sessions[auth_address] ;
                            ls_save() ;
                            return cb() ;
                        }
                        if (array.length != array_names.length) {
                            console.log(pgm + 'error in saved session for ' + auth_address + '. Expected encrypted_info array.length = ' + array_names.length + '. Found length = ' + array.length) ;
                            delete ls.mn_sessions[auth_address] ;
                            ls_save() ;
                            return cb() ;
                        }
                        for (i=0; i<array_names.length ; i++) {
                            if (typeof array[i] != 'string') {
                                console.log(pgm + 'error in saved session for ' + auth_address + '. Expected ' + array_names[i] + ' to be a string. array[' + i + '] = "' + JSON.stringify(array[i]) + '"') ;
                                delete ls.mn_sessions[auth_address] ;
                                ls_save() ;
                                return cb() ;
                            }
                        }
                        temp_pwd1 = array[0] ;
                        // setup temporary encryption for get_password message.
                        // special encryption for get_password request! No sessionid and no JSEncrypt prvkey (normally 3 layers encryption)
                        // request is encrypted with JSEncrypt and cryptMessage (encryptions=[1,2]) using MN public keys
                        // response is encrypted with cryptMessage only (encryptions=[2]) using W3 cryptMessage public key
                        encrypt2 = new MoneyNetworkAPI({
                            debug: 'encrypt2',
                            pubkey: info.other_pubkey,
                            pubkey2: info.other_pubkey2,
                            user_path: user_path,
                            this_session_filename: array[2],
                            other_session_filename: array[3]
                        }) ;
                        // send get_password request. wait for max 10 seconds for response. MN session must be running and user must be logged in with correct account
                        request = {
                            msgtype: 'get_password',
                            pubkey: info.this_pubkey,
                            pubkey2: info.this_pubkey2,
                            unlock_pwd2: array[1]
                        } ;
                        console.log(pgm + 'found old session. sending get_password request to MN. request = ' + JSON.stringify(request)) ;
                        // using long timeout 30 seconds for slow devices. timeout message feedback cannot be used for get_password timeout. get_password is only run once at wallet page startup
                        // console.log(pgm + 'todo: change get_password timeout to 30 seconds. now just testing with a short timeout to force ping problems in mn session. https://github.com/jaros1/Money-Network/issues/199#issuecomment-345459224') ;
                        encrypt2.send_message(request, {encryptions:[1,2], response:30000}, function (response) {
                            var pgm = service + '.is_old_session send_message callback 3: ' ;
                            var temp_pwd2, temp_pwd, temp_prvkey, temp_sessionid, encrypted_pwd2, request, group_debug_seq ;
                            if (response && response.error && response.error.match(/^Timeout /)) {
                                // OK. timeout after 5 seconds. MN session not running or not logged in
                                // error = "Timeout while waiting for response. Request was {\"msgtype\":\"get_password\",\"pubkey\":\"-----BEGIN PUBLIC KEY-----\\nMIGeMA0GCSqGSIb3DQEBAQUAA4GMADCBiAKBgHkYQzcBcq7nc8ktXslYyhkZrlja\\n7fGxu5cxqGVhp/w+905YT4jriF0IosiBeDyPGCJdQCS0IfJ9wMHP1rSIJ7KvLI5R\\nzfFcdqOMliMzEeTva29rkCmZSNw++2x7aIJQO9aExp03bm/l49zh/MbwFnZmrmS7\\nAOGgDzFPapIUQXenAgMBAAE=\\n-----END PUBLIC KEY-----\",\"pubkey2\":\"Ahn94vCUvT+S/nefej83M02n/hP8Jvqc8KbxMtdSsT8R\",\"unlock_pwd2\":\"280eab8147\",\"response\":1469138736361}. Expected response filename was 3253c3b046.1469138736361"
                                console.log(pgm + 'OK. Timeout for get_password request. MN session is not running, busy or not logged in. Cannot restore old session from localStorage');
                                status.session_handshake = 'n/a' ;
                                return cb() ;
                            }
                            if (!response || response.error) {
                                console.log(pgm + 'get_password request failed. response = ' + JSON.stringify(response)) ;
                                status.session_handshake = 'n/a' ;
                                return cb() ;
                            }
                            console.log(pgm + 'got get_password response from MN. response = ' + JSON.stringify(response));
                            // got cryptMessage encrypted pwd2 from MN
                            encrypted_pwd2 = response.password ;
                            temp_pwd2 = MoneyNetworkAPILib.aes_decrypt(encrypted_pwd2, temp_pwd1) ;
                            temp_pwd = temp_pwd1 + temp_pwd2 ;
                            // console.log(pgm + 'got encrypted pwd2 from MN. encrypted_pwd2 = ' + encrypted_pwd2 + ', temp_pwd2 = ' + temp_pwd2) ;
                            // console.log(pgm + 'decrypting prvkey. info.prevkey = ' + info.prvkey + ', temp_pwd = ' + temp_pwd) ;
                            temp_prvkey = MoneyNetworkAPILib.aes_decrypt(info.prvkey, temp_pwd) ;
                            // console.log(pgm + 'decrypted prvkey. prvkey = ' + temp_prvkey) ;

                            temp_sessionid = MoneyNetworkAPILib.aes_decrypt(info.sessionid, temp_pwd) ;
                            status.session_handshake = 'Old session was restored from localStorage' ;
                            status.sessionid = temp_sessionid ;
                            encrypt2 = new MoneyNetworkAPI({
                                debug: 'encrypt2',
                                sessionid: temp_sessionid,
                                pubkey: info.other_pubkey,
                                pubkey2: info.other_pubkey2,
                                prvkey: temp_prvkey,
                                user_path: user_path
                            }) ;
                            // encrypt2 object must have session filenames initialized before starting group operation
                            encrypt2.get_session_filenames({}, function () {
                                var pgm = service + '.is_old_session get_session_filenames callback 4: ' ;
                                var request, timeout_at,
                                group_debug_seq = MoneyNetworkAPILib.debug_group_operation_start() ;

                                // https://github.com/jaros1/Money-Network/issues/208
                                // todo: loaded old session from Ls. No pubkeys message to MN. Send ping to MN instead so that MN known that session is up and running
                                // send ping. do not wait for response. cleanup in 30 seconds.
                                request = { msgtype: 'ping' };
                                timeout_at = new Date().getTime() + 30000 ;
                                console.log(pgm + 'restored old session. send ping to MN session with old sessionid ' + status.sessionid) ;
                                encrypt2.send_message(request, {timeout_at: timeout_at, group_debug_seq: group_debug_seq}, function (response) {
                                    var pgm = service + '.is_old_session send_message callback 5/' + group_debug_seq + ': ' ;
                                    console.log(pgm + 'response = ' + JSON.stringify(response)) ;
                                    //if (response && response.error && response.error.match(/^Timeout /)) {
                                    //    // OK. Timeout. Continue with next session
                                    //    console.log(pgm + 'ping old sessionid ' + status.sessionid + ' timeout');
                                    //}
                                    //else if (!response || response.error) {
                                    //    // Unexpected error.
                                    //    console.log(pgm + 'ping old sessionid ' + status.sessionid + ' returned ' + JSON.stringify(response));
                                    //    info.status = 'Test failed';
                                    //    info.disabled = true;
                                    //    return test2_open_url.run();
                                    //}

                                    //else console.log(pgm + 'ping old sessionid ' + status.sessionid + ' OK') ;
                                    cb(status.sessionid) ;
                                }) ; // send_message callback 5

                            }) ; // get_session_filenames callback 4

                        }) ; // send_message callback 3

                    }) ; // decrypt_2 callback 2

                }) ; // get_user_path callback 1

            } // is_old_session

            // w3 startup 6: check new session
            function is_new_session (cb) {
                var pgm = service + '.is_new_session: ' ;
                var a_path, z_path ;
                if (!cb) cb = function() {} ;
                if (status.sessionid) {
                    console.log(pgm + 'invalid call. sessionid already found. status.sessionid = ' + status.sessionid + ', encrypt2.sessionid = ' + encrypt2.sessionid) ;
                    cb(status.sessionid) ;
                    return false ;
                } // continue old session
                if (!new_sessionid) {
                    console.log(pgm + 'no sessionid was received from MN') ;
                    cb() ;
                    return false ;
                }
                status.sessionid = new_sessionid ;
                MoneyNetworkAPILib.add_session(status.sessionid); // monitor incoming messages for this sessionid
                encrypt2.setup_encryption({sessionid: status.sessionid, debug: true}) ;
                console.log(pgm + 'encrypt2.other_session_filename = ' + encrypt2.other_session_filename) ;
                console.log(pgm + 'sessionid              = ' + status.sessionid) ;
                // read MN public keys message using dbQuery loop and z_file_get operations
                read_pubkeys(function (ok) {
                    var pgm = service + '.is_new_session read_pubkeys callback: ' ;
                    console.log(pgm + 'ok = ' + JSON.stringify(ok)) ;
                    console.log(pgm + 'saved sessionid = ' + status.sessionid) ;
                    cb(status.sessionid) ;
                }) ; // read_pubkeys callback
            } // is_new_session

            // startup sequence 2-6:
            // params:
            // - startup: true: startup, false: changed cert_user_id
            // - cb: callback function. returns sessionid and save_wallet_login
            var old_auth_address ;
            function initialize (startup, cb) {
                var pgm = service + '.initialize: ' ;
                if (!cb) cb = function() {} ;
                if (!startup && old_auth_address && ZeroFrame.site_info && (old_auth_address != ZeroFrame.site_info.auth_address)) {
                    // reset session variables
                    console.log(pgm + 'changed ZeroNet certificate. reset encrypts and sessionid') ;
                    status.sessionid = null ;
                    encrypt1 = new MoneyNetworkAPI({debug: 'encrypt1'}) ;
                    encrypt2 = new MoneyNetworkAPI({debug: 'encrypt2'}) ;
                    old_auth_address = ZeroFrame.site_info.auth_address ;
                }

                console.log(pgm + 'step 2: check merger permission') ;
                check_merger_permission(function(ok) {
                    var pgm = service + '.initialize check_merger_permission callback 1: ' ;
                    if (!ok) {
                        // no merger permission
                        console.log(pgm + 'stop initialize. no merger permission. MN-W3 session is not possible without merger permission') ;
                        return cb(null) ;
                    }

                    console.log(pgm + 'check ZeroNet log in') ;
                    if (!ZeroFrame.site_info.cert_user_id) {
                        // not logged in
                        console.log(pgm + 'stop initialize. not logged in. MN-W3 session is not possible without a ZeroNet log in') ;
                        return cb(null);
                    }
                    old_auth_address = ZeroFrame.site_info.auth_address ;
                    status.old_cert_user_id = ZeroFrame.site_info.cert_user_id ;

                    // step 3: get permissions
                    console.log(pgm + 'step 3: get permissions') ;
                    get_permissions(function (res) {
                        var pgm = service + '.initialize get_permissions callback 2: ' ;
                        console.log(pgm + 'get_permissions. res = ' + JSON.stringify(res)) ;

                        // delete old status.json file. not longer needed
                        delete_status_json(function () {
                            var pgm = service + '.initialize delete_status_json callback 3: ' ;

                            // step 4 - update wallet.json
                            console.log(pgm + 'step 4: update wallet.json') ;
                            update_wallet_json(function (res) {
                                var pgm = service + '.initialize update_wallet_json callback 4: ';
                                var optional_get_wallet_login;
                                console.log(pgm + 'update_wallet_json. res = ' + JSON.stringify(res));

                                // save_login == '1'. wallet login saved on W3 localStorage
                                optional_get_wallet_login = function (cb) {
                                    if (!ls.save_login) ls.save_login = {};
                                    if (!ls.save_login[old_auth_address]) ls.save_login[old_auth_address] = {choice: '0'};
                                    if (ls.save_login[old_auth_address].choice != '1') return cb() ; // skip. not saved or 2: saved in MN ls
                                    // wallet log in saved in w3 ls. restore now
                                    get_wallet_login('1', function(wallet_id, wallet_password, error) {
                                        console.log(pgm + 'wallet_id = ' + wallet_id + ', wallet_password = ' + wallet_password + ', error = ' + error) ;
                                        console.log(pgm + 'status = ' + JSON.stringify(status)) ;
                                        if (!error) $rootScope.$apply() ;
                                        cb() ;
                                    }) ;
                                } ;
                                optional_get_wallet_login(function(){
                                    var done ;

                                    // extend cb.
                                    // - lookup save_login[].choice (radio group) from ls
                                    // - cleanup old outgoing files
                                    done = function (sessionid) {
                                        var pgm = service + '.initialize.done: ';
                                        var save_wallet_login, w3_query_5, directory, debug_seq;
                                        // sessionid found. remember login.
                                        if (!ls.save_login) ls.save_login = {};
                                        // console.log(pgm + 'ls.save_login = ' + JSON.stringify(ls.save_login)) ;
                                        if (!ls.save_login[old_auth_address]) ls.save_login[old_auth_address] = {choice: '0'};
                                        save_wallet_login = ls.save_login[old_auth_address].choice;
                                        ls_save();

                                        // cleanup old outgoing money transaction files
                                        // do not cleanup -o offline and normal files.See cleanup_offline_session_files
                                        // find outgoing money transactions

                                        // query 1. simple get all optional files for current user directory
                                        // todo: optional files and actual files on file system can be out of sync. Should delete files_optional + sign to be sure that optional files and file system matches
                                        directory = z_cache.my_wallet_data_hub + "/data/users/" + ZeroFrame.site_info.auth_address;
                                        w3_query_5 =
                                            "select files_optional.filename from json, files_optional " +
                                            "where directory like '" + directory + "' " +
                                            "and file_name = 'content.json' " +
                                            "and files_optional.json_id = json.json_id";
                                        console.log(pgm + 'w3_query_5 = ' + w3_query_5);
                                        debug_seq = MoneyNetworkAPILib.debug_z_api_operation_start(pgm, 'w3 query 5', 'dbQuery');
                                        ZeroFrame.cmd("dbQuery", [w3_query_5], function (files) {
                                            var pgm = service + '.initialize.done dbQuery 1: ';
                                            var files, i, re, get_file_info, m, optional;
                                            MoneyNetworkAPILib.debug_z_api_operation_end(debug_seq, (!files || files.error) ? 'Failed. error = ' + JSON.stringify(res) : 'OK. Returned ' + files.length + ' rows');
                                            if (files.error) {
                                                console.log(pgm + 'query failed. error = ' + files.error);
                                                console.log(pgm + 'w3_query_5 = ' + w3_query_5);
                                                return;
                                            }
                                            // keeping only -i, -e and -p optional files in cleanup loop
                                            // todo: must add a manual cleanup for offline and manual files. Not cannot used timestamp
                                            re = new RegExp('^[0-9a-f]{10}(-i|-e|-o|-io|-p)\.[0-9]{13}$');
                                            for (i = files.length - 1; i >= 0; i--) {
                                                m = files[i].filename.match(re);
                                                if (!m) {
                                                    // not a money transaction file
                                                    files.splice(i, 1);
                                                    continue;
                                                }
                                                optional = m[1];
                                                if (['-i', '-e', '-p'].indexOf(optional) == -1) {
                                                    // offline transaction or normal file (fallback for offline transaction)
                                                    files.splice(i, 1);
                                                }
                                            }
                                            console.log(pgm + 'files = ' + JSON.stringify(files));

                                            // get file info before starting file deletes. must only delete outgoing optional files
                                            console.log(pgm + 'checking file_info for optional files list. do not delete incoming not downloaded optional files');
                                            get_file_info = function (i, cb) {
                                                var pgm = service + '.initialize.cb.get_file_info: ';
                                                var inner_path, debug_seq;
                                                if (i >= files.length) {
                                                    // done with file info lookup. continue with delete files
                                                    console.log(pgm + 'done with file info lookup. i = ' + i + ', files.length = ' + files.length + ' continue with delete files');
                                                    return cb();
                                                }
                                                inner_path = 'merged-' + get_merged_type() + '/' + directory + '/' + files[i].filename;
                                                debug_seq = MoneyNetworkAPILib.debug_z_api_operation_start(pgm, inner_path, 'optionalFileInfo');
                                                ZeroFrame.cmd("optionalFileInfo", [inner_path], function (file_info) {
                                                    MoneyNetworkAPILib.debug_z_api_operation_end(debug_seq, file_info ? 'OK' : 'Not found');
                                                    console.log(pgm + 'i = ' + i + ', inner_path = ' + inner_path + ', file_info = ' + JSON.stringify(file_info));
                                                    //i = 0, inner_path = merged-MoneyNetwork/1HXzvtSLuvxZfh6LgdaqTk4FSVf7x8w7NJ/data/users/18DbeZgtVCcLghmtzvg4Uv8uRQAwR8wnDQ/aaca9a8ff7.1509003997742, file_info = null

                                                    files[i].file_info = file_info;
                                                    get_file_info(i + 1, cb);
                                                }); // optionalFileInfo callback
                                            }; // check_files
                                            get_file_info(0, function () {
                                                var pgm = service + '.initialize.done get_file_info callback 2: ';
                                                var delete_tmp_files, i, filename, file_info, this_session_filename, timestamp, delete_ok, delete_failed, delete_tmp_file;

                                                console.log(pgm + 'files with file_info = ' + JSON.stringify(files));
                                                //files with file_info = [{
                                                //    "filename": "aaca9a8ff7.1509003997742",
                                                //    "file_info": null
                                                //}];

                                                delete_tmp_files = [];
                                                for (i = 0; i < files.length; i++) {
                                                    filename = files[i].filename;
                                                    file_info = files[i].file_info;
                                                    if (!file_info) {
                                                        console.log(pgm + 'info_info (normal file or deleted optional file) = empty!');
                                                        continue;
                                                    }
                                                    if (file_info.is_downloaded && (file_info.time_added == file_info.time_downloaded)) {
                                                        console.log(pgm + 'file_info (outgoing optional file) = ' + JSON.stringify(file_info));
                                                    }
                                                    else {
                                                        console.log(pgm + 'file_info (ingoing optional file) = ' + JSON.stringify(file_info));
                                                        continue;
                                                    }
                                                    this_session_filename = filename.substr(0, 10);
                                                    if (this_session_filename != encrypt2.this_session_filename) {
                                                        // unknown (old) session
                                                        delete_tmp_files.push(filename);
                                                        continue;
                                                    }
                                                    timestamp = parseInt(filename.substr(-13));
                                                    if (!encrypt2.session_at) {
                                                        console.log(pgm + 'no session_at timestamp was found for this_session_filename = ' + this_session_filename + '. maybe not restored session. using service_started_at');
                                                        encrypt2.session_at = service_started_at;
                                                    }
                                                    if (timestamp < encrypt2.session_at) {
                                                        // old outgoing money transaction message
                                                        delete_tmp_files.push(filename);
                                                    }
                                                } // i
                                                console.log(pgm + 'delete_tmp_files = ' + JSON.stringify(delete_tmp_files));
                                                // delete_tmp_files = ["041e012302-i.1515156194073","041e012302-i.1515156203845","041e012302-i.1515156196983","041e012302-i.1515156195931","041e012302-i.1515156194945","041e012302-i.1515156204913","041e012302-i.1515156164248","041e012302-i.1515156586064"]

                                                // delete file loop
                                                delete_ok = [];
                                                delete_failed = [];
                                                delete_tmp_file = function (transaction_timestamp) {
                                                    var pgm = service + '.initialize.done.delete_tmp_file: ';
                                                    var filename, inner_path;
                                                    if (status.restoring) return cb(sessionid, save_wallet_login) ; // stop. restore operation started
                                                    if (!delete_tmp_files.length) {
                                                        // finish deleting old temporary optional files (-i, -e and -p)
                                                        MoneyNetworkAPILib.end_transaction(transaction_timestamp);
                                                        if (!delete_ok.length) {
                                                            // nothing to sign
                                                            cb(sessionid, save_wallet_login);
                                                        }
                                                        // sign only. publish: false. publish is pending. see publish in cleanup_offline_session_files
                                                        else z_publish({}, function (res) {
                                                            cb(sessionid, save_wallet_login);
                                                        });
                                                        return;
                                                    } // done

                                                    filename = delete_tmp_files.shift();
                                                    inner_path = 'merged-' + get_merged_type() + '/' + z_cache.my_wallet_data_hub + '/data/users/' + ZeroFrame.site_info.auth_address + '/' + filename;

                                                    // issue #1140. https://github.com/HelloZeroNet/ZeroNet/issues/1140
                                                    // false Delete error: [Errno 2] No such file or directory error returned from fileDelete
                                                    MoneyNetworkAPILib.z_file_delete(pgm, inner_path, function (res) {
                                                        if (res == 'ok') delete_ok.push(filename);
                                                        else delete_failed.push(filename);
                                                        delete_tmp_file(transaction_timestamp);
                                                    });

                                                }; // delete_tmp_file

                                                // start delete file loop
                                                // transaction. don't delete files while publishing
                                                MoneyNetworkAPILib.start_transaction(pgm, function (transaction_timestamp) {
                                                    delete_tmp_file(transaction_timestamp);
                                                });

                                            }); // done get_file_info callback 2

                                        }); // done dbQuery callback 1

                                    }; // done

                                    // todo: save_login = '1'. get wallet login before trying

                                    // check for old (1. priority) or new (2. priority) session
                                    // step 5 - check old session
                                    console.log(pgm + 'step 5: check old session');
                                    is_old_session(function (sessionid) {
                                        var pgm = service + '.initialize is_old_session callback 5: ';
                                        console.log(pgm + 'sessionid = ' + JSON.stringify(sessionid));
                                        if (sessionid) {
                                            $rootScope.$apply();
                                            return done(sessionid);
                                        } // session was restored from localStorage
                                        // step 6 - check new session
                                        console.log(pgm + 'step 6: check new session');
                                        is_new_session(function (sessionid) {
                                            var pgm = service + '.initialize is_new_session callback 6: ';
                                            console.log(pgm + 'sessionid = ' + JSON.stringify(sessionid));
                                            if (!sessionid) return done(null);
                                            $rootScope.$apply();
                                            save_mn_session(function () {
                                                done(sessionid)
                                            });
                                        }); // is_new_session callback 6

                                    }); // is_old_session callback 5

                                }) ;

                            }); // update_wallet_json callback 4

                        }) ; // delete_status_json callback 3

                    }) ; // get_permissions callback 2

                }) ; // check_merger_permission callback 1

            } // initialize

            function generate_random_string(length, use_special_characters) {
                var character_set = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
                if (use_special_characters) character_set += '![]{}#%&/()=?+-:;_-.@$|£' ;
                var string = [], index, char;
                for (var i = 0; i < length; i++) {
                    index = Math.floor(Math.random() * character_set.length);
                    char = character_set.substr(index, 1);
                    string.push(char);
                }
                return string.join('');
            } // generate_random_string

            // send current wallet balance to MN
            function send_balance (cb) {
                var pgm = service + '.send_balance: ' ;
                var wei_bn, request, ether_bn, ether_s ;
                if (!status.sessionid) return cb('Cannot send balance to MoneyNetwork. No session found') ;
                if (wallet_info.status != 'Open') return cb('Cannot send balance to MoneyNetwork. Wallet not open');
                // send balance to MN
                wei_bn = new BigNumber(wallet_info.confirmed_balance) ;
                ether_bn = wei_bn.dividedBy(wei_factor) ;
                ether_s = bn_toFixed(ether_bn, 18, false) ;
                request = {
                    msgtype: 'balance',
                    balance: [ {code: 'tETH', amount: ether_s} ],
                    balance_at: new Date().getTime()
                } ;
                console.log(pgm + 'status.sessionid =' + status.sessionid + ', encrypt2.sessionid = ' + encrypt2.sessionid) ;
                encrypt2.send_message(request, { response: 5000}, function (response) {
                    if (!response || response.error) return cb('Could not send balance to MN. Response = ' + JSON.stringify(response)) ;
                    else cb() ;
                }) ;
            } // send_balance


            // open wallet url in a new browser tab
            // write warning in console.log. exception is raised in parent frame and cannot be catch here
            function open_window (pgm, url) {
                console.log(pgm + 'opening url ' + url + " in a new browser tab. open window maybe blocked in browser. chrome+opera: Uncaught TypeError: Cannot set property 'opener' of null") ;
                return ZeroFrame.cmd("wrapperOpenWindow", [url, "_blank"]);
            } // open_window

            // download and help distribute all files? (user data hubs). used for public chat
            var help = { bol: false } ;
            function set_help (value) {
                var pgm = service + '.set_help: ' ;
                var help_str, change_settings ;
                console.log(pgm + 'value = ' + JSON.stringify(value)) ;
                if ([true, false].indexOf(value) != -1) {
                    // set from add hubs section
                    help.bol = value ;
                    // change setting for all user data hubs. todo: where to find old value?
                    MoneyNetworkAPILib.get_all_hubs(false, function (all_hubs) {
                        var all_hubs_clone, i ;
                        all_hubs_clone = [] ;
                        for (i=0 ; i<all_hubs.length ; i++) {
                            if (all_hubs[i].hub_type == 'user') continue ; // MN user data hub
                            if (!all_hubs[i].hub_title || all_hubs[i].hub_title.match(/^w3 /i)) all_hubs_clone.push(all_hubs[i]) ;
                        }
                        change_settings = function() {
                            var hub_info ;
                            hub_info = all_hubs_clone.shift() ;
                            if (!hub_info) return ; // done
                            if (hub_info.hub_type != 'wallet') return change_settings() ;
                            if (hub_info.hub_title && !hub_info.hub_title.match(/w3 /i)) return change_settings() ;
                            if (!hub_info.hub_added) return change_settings() ;
                            ZeroFrame.cmd("OptionalHelpAll", [value, hub_info.hub], function (res) {
                                change_settings() ;
                            }) ;
                        } ;
                        change_settings() ;
                    }) ;
                }
                else {
                    // startup. get from ls
                    help.bol = ls.help || false ;
                }
                ls.help = help.bol ;
                ls_save() ;
            }
            function get_help () {
                return help ;
            }

            // export W3Service
            return {
                // localStorage functions
                ls_bind: ls_bind,
                ls_get: ls_get,
                ls_save: ls_save,
                get_wallet_login: get_wallet_login,
                save_wallet_login: save_wallet_login,
                // session functions
                generate_random_string: generate_random_string,
                is_sessionid: is_sessionid,
                initialize: initialize,
                get_status: get_status,
                save_permissions: save_permissions,
                send_balance: send_balance,
                open_window: open_window,
                z_wrapper_notification:  z_wrapper_notification,
                move_user_profile: move_user_profile,
                get_my_wallet_hub: get_my_wallet_hub,
                set_help: set_help,
                get_help: get_help,
                run_pending_publish: run_pending_publish
            };

            // end W3Service
        }])

;
