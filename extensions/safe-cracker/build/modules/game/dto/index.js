'use strict';

var attempt_dto = require('./attempt.dto');
var startGame_dto = require('./start-game.dto');



Object.keys(attempt_dto).forEach(function (k) {
	if (k !== 'default' && !Object.prototype.hasOwnProperty.call(exports, k)) Object.defineProperty(exports, k, {
		enumerable: true,
		get: function () { return attempt_dto[k]; }
	});
});
Object.keys(startGame_dto).forEach(function (k) {
	if (k !== 'default' && !Object.prototype.hasOwnProperty.call(exports, k)) Object.defineProperty(exports, k, {
		enumerable: true,
		get: function () { return startGame_dto[k]; }
	});
});
//# sourceMappingURL=index.js.map
//# sourceMappingURL=index.js.map