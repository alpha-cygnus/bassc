"use strict";
define(
    [
    'bassc/core',
    'bassc/pu',
    //'load/pegjs!grammar/bc'
    ],
    function(BC, BCPU, grammar) {

console.log('Hello, world!');

var _urlParams = window.location.search.substr(1).split('&')
    .filter(x => x).map(x => x.split('='))
    .reduce((res, x) => {
        var [n, v] = x.map(decodeURIComponent);
        res[n] = res[n] || [];
        res[n].push(v);
        return res;
    }, {});

function showError(msg) {
    $('#error').html($('#error').html() + msg + '<br />');
}

BCPU.onShowError = showError;

require(['load/bc!prelude'], function(prelude) {
    console.log('prelude', prelude);
});

return {};

});
