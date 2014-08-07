/**
 * Стандартный препроцессор документа, который меняет ссылки 
 * на ресурсы внутри HTML/XML документа. Работает на основе конфига:
 * пути относительно `root` превращаются в абсолютные
 * и им добавляется `prefix`.
 * Полученный адрес может быть переработан методом `transform`. 
 */
var fs = require('fs');
var path = require('path');

var defaultConfig = {
	/** 
	 * Путь к document root исходного файла, относительно 
	 * которого будем строить ссылки из документа.
	 */
	root: process.cwd(),

	/** 
	 * Префикс, который нужно добавить к итоговому URL
	 */
	prefix: '',

	/**
	 * Проверяет, можно ли указанный элемент пропускать через процессор
	 * @param  {Object} node DOM-элемент
	 * @return {Array} Список атрибутов, которые нужно переписать 
	 * у указанного элемента
	 */
	match: function(node) {
		return node && node.name && this.rewriteMap[node.name];
	},

	/**
	 * Проверяет, можно ли переписывать указанный URL
	 * @param  {String}
	 * @return {Boolean}
	 */
	validUrl: function(url) {
		return !/^([a-z]+:)?\/\//i.test(url) && !/^data:/.test(url);
	},

	/**
	 * Метод, который вызывается перед тем, как URL перезаписан.
	 * Позволяет произвольно изменить URL
	 * @param  {String} url  Итоговый url
	 * @param  {Object} info Дополнительная информация об адресе
	 * @return {String}
	 */
	transform: function(url, info) {
		return url;
	},

	/**
	 * Карта элементов, где нужно делать перезапись, а также список атрибутов,
	 * которые можно менять в этих элементах
	 */
	rewriteMap: {
		img: ['src', 'data-src'],
		script: ['src'],
		link: ['href'],
		a: ['href'],
		video: ['src'],
		audio: ['src'],
		iframe: ['src'],
		source: ['src'],
		embed: ['src'],
		form: ['action'],
		object: ['data'],
		param: ['value']
	}
};

function copy(dest) {
	var args = Array.prototype.slice.call(arguments, 1);
	args.forEach(function(arg) {
		if (!arg) {
			return;
		}

		Object.keys(arg).forEach(function(key) {
			dest[key] = arg[key];
		});
	});

	return dest;
}

function buildConfig(config) {
	if (typeof config === 'function') {
		config = {transform: config};
	}

	var out = copy({}, defaultConfig, config);
	if (config && config.rewriteMap) {
		out.rewriteMap = copy({}, defaultConfig.rewriteMap, config.rewriteMap);
	}

	return out;
}

/**
 * Возвращает абсолютный путь к указанному ресурсу
 * @param  {String} url       Путь, который нужно резолвить
 * @param  {String} parentUrl Путь к родительскому файлу, в котором находится `url`
 * @param  {String} root      Путь к document root проекта. Относитеьно него будут 
 * резолвится абсолютные `url`
 * @return {String}
 */
function absoluteUrl(url, parentUrl, root) {
	if (url[0] === '/') {
		return url;
	}

	var out = path.normalize(path.join(path.dirname(parentUrl), url));
	if (out.substr(0, root.length) === root) {
		out = out.substr(root.length);
		if (out[0] !== '/') {
			out = '/' + out;
		}
	}

	return out;
}

function actualUrl(file, root) {
	if (!file) {
		return null;
	}
	
	if (file[0] === '/') {
		file = file.substr(1);
	}

	return path.join(root, file);
}

/**
 * Переделывает указанный URL: добавляет к нему `prefix` и следит 
 * за «чистотой» адреса 
 * @param  {String} url    Абсолютный URL, который нужно переделать
 * @param  {String} prefix Префикс, который нужно добавить к адресу
 * @return {String}
 */
function rebuildUrl(url, prefix) {
	if (prefix) {
		url = path.join(prefix, url).replace(/\/{2,}/g, '/');
	}

	return url;
}

function findNodesToRewrite(nodes, config, out) {
	out = out || [];
	nodes.forEach(function(node) {
		var attrs = config.match(node);
		if (attrs) {
			attrs.forEach(function(name) {
				if (node.attribs[name] && config.validUrl(node.attribs[name])) {
					out.push({
						node: node,
						attribute: name
					});
				}
			});
		}

		if (node.children) {
			findNodesToRewrite(node.children, config, out);
		}
	});

	return out;
}

module.exports = function(config) {
	config = buildConfig(config);
	return function(dom, res) {
		findNodesToRewrite(dom, config).forEach(function(item) {
			var absUrl = absoluteUrl(item.node.attribs[item.attribute], res.file, config.root);
			var targetUrl = rebuildUrl(absUrl, config.prefix);
			if (config.transform) {
				targetUrl = config.transform(targetUrl, {
					clean: absUrl,
					root: config.root,
					prefix: config.prefix,
					actual: actualUrl(absUrl, config.root),
					context: item
				});
			}

			item.node.attribs[item.attribute] = targetUrl;
		});
	};
};

module.exports.config = defaultConfig;
