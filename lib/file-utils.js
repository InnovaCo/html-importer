/**
 * Утилиты для работы с файлами
 */
var fs = require('fs');
var path = require('path');
var glob = require('glob');
var async = require('async');
var mkdirp = require('mkdirp');

/**
 * Читает содержимое файлов, переданных в списке
 * @param  {Array}    list     Список путей к файлам, которые нужно прочитать
 * @param  {Function} callback
 */
function readList(list, callback) {
	async.map(list, function(file, callback) {
		fs.readFile(file, {encoding: 'utf8'}, function(err, content) {
			callback(err, {
				file: file,
				content: content
			});
		});
	}, callback);
}

function absPathList(list, options) {
	if (options && options.cwd) {
		list = list.map(function(p) {
			return path.normalize(path.join(options.cwd, p));
		});
	}

	return list;
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

		var output = [];
		async.each(f, function(file, callback) {
			if (file instanceof Buffer) {
				output.push({
					file: null,
					content: file.toString()
				});
				return callback();
			}

			async.waterfall([
				function(callback) {
					glob(file, options, callback)
				},
				function(result, callback) {
					callback(null, absPathList(result, options));
				},
				readList,
				function(content, callback) {
					callback(null, output = output.concat(content));
				}
			], callback);
		}, function(err) {
			callback(err, output);
		});
	},

	/**
	 * Быстрое копирование файлов
	 * @param  {String}   source Откуда копировать файл
	 * @param  {String}   target Куда копировать файл
	 * @param  {Function} callback
	 */
	copy: function(source, target, callback) {
		async.waterfall([
			function(callback) {
				mkdirp(path.dirname(target), callback);
			},
			function(result, callback) {
				var cbCalled = false;
				var done = function(err) {
					if (!cbCalled) {
						callback(err);
						cbCalled = true;
					}
				};

				var rd = fs.createReadStream(source);
				rd.on('error', done);

				var wr = fs.createWriteStream(target);
				wr.on('error', done);
				wr.on('close', function(ex) {
					done();
				});
				rd.pipe(wr);
			}
		], callback);
	}
};