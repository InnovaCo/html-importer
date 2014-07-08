/**
 * Утилиты для работы с файлами
 */
var fs = require('fs');
var path = require('path');
var glob = require('glob');

/**
 * Читает содержимое файлов, переданных в списке
 * @param  {Array}    list     Список путей к файлам, которые нужно прочитать
 * @param  {Function} callback
 */
function readList(list, callback) {
	var input = list.slice(0);
	var output = [];
	var next = function() {
		if (!input.length) {
			return callback(null, output);
		}

		var cur = input.shift();
		fs.readFile(cur, {encoding: 'utf8'}, function(err, content) {
			if (err) {
				return callback(err);
			}

			output.push({
				file: cur,
				content: content
			});
			next();
		});
	};
	next();
}

function absPathList(list, options) {
	options = options || {};
	var cwd = options.cwd || process.cwd();
	return list.map(function(p) {
		return path.normalize(path.join(cwd, p));
	});
}

module.exports = {
	read: function(f, options, callback) {
		if (!Array.isArray(f)) {
			f = [f];
		}

		if (typeof options === 'function') {
			callback = options;
			options = {};
		}

		var input = f.slice(0);
		var output = [];
		var next = function() {
			if (!input.length) {
				return callback(null, output);
			}

			var cur = input.shift();
			if (cur instanceof Buffer) {
				output.push({
					file: null,
					content: cur.toString()
				});
				return next();
			}

			glob(cur, options, function(err, result) {
				if (err) {
					return callback(err);
				}

				readList(absPathList(result, options), function(err, content) {
					if (err) {
						return callback(err);
					}
					output = output.concat(content);
					next();
				});
			});
		};

		next();
	}
};