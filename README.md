# Трансформация HTML через XSLT

Модуль позволяет применить XSL-транформации указанным HTML-файлам, даже если это невалидный XML.

В отличие от обычного преобразования, доступного в популярных XSLT-процессорах (например, `libxslt`), даёт следующие преимущества:

* Полноценный Node.JS модуль, который можно встраивать в другие проекты.
* Поддержка [glob-шаблонов](http://man7.org/linux/man-pages/man7/glob.7.html).
* Возможность препроцессинга HTML/XML документов перед XSL-преобразованием.
* Поддержка [XSLT-препроцессора](https://github.inn.ru/template/preprocessor).

## Установка

В консоли выполняем:

```
npm install git+https://github.inn.ru/template/html-transform.git
```

Дополнительно может понадобится установить [некоторые зависимости](https://github.com/bsuh/node_xslt#requirements), необходимые для сборки libxslt-моста. В частности, это понадобится для установки на Linux-сервер.

## Использование

```js
var htmlTransformer = require('html-transform');

htmlTransformer.transform(html, xsl, options, callback);
```

Параметры:

* `html` (`Buffer|String|Array`) – входящие данные для преобразования. Может быть непосредственно содержимым файла (`Buffer`), путём к файлу с использованием glob-шаблонов (`String`) либо массивом буфферов и/или строк.
* `xsl` (`Buffer|String|Array`) — XSLT-шаблоны, которые нужно применить входящим файлам. Типы данных такие же, как и в параметре `html`.
* `options` (`Object`) – необязательный параметр с дополнительными опциями. Передаётся «как есть» в модуль [`glob`](https://github.com/isaacs/node-glob#options).
* `options.process` (`Function`) — функция предварительно обработки DOM-дерева входящего документа *до* того, как он попадёт в XSL-трансформатор. Первым параметром функция принимает DOM-дерево, полученное модулем [`DomHandler`](https://github.com/fb55/domhandler). Обработчик должен модифицировать само дерево, а не возвращать новое. В случае, если обработчик должен работать асинхронно, функция обработчика должна принимать два параметра: вторым будет callback-функция, которую нужно вызвать по завершению работы обработчика.
* `callback(err, result)` — функция, вызываемая после того, как все преобразования завершаться. Первым параметром принимает ошибку (если такая возникла во время преобразования), вторым — массив объектов. Объекты содержат свойства `file` (абсолютный путь к входящему файлу) и `content` (преобразованное содержимое файла).

Более подробные примеры можно [увидеть в тестах](https://github.inn.ru/template/html-transform/blob/master/test/suite.js#L35).