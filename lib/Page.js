// The page model representing the source page to scrape from
'use strict';
var _ = require('lodash'),
    Promise = require('bluebird'),
    request = Promise.promisify(require('request')),
    cheerio = require('cheerio'),
    find = require('cheerio-eq'),
    format = require('util').format,
    Blueprint = require('./Blueprint'),
    PageItem = require('./PageItem'),
    tidy = Promise.promisify(require('htmltidy').tidy);

var Page = function(options){
  var page = this;
  if (!options || typeof options !== 'object'){
    throw new Error("options was not provided or not an object");
  } else if (!options.blueprint || !(options.blueprint instanceof Blueprint)){
    throw new Error("options.pageItem was not provided or is not an instanceof PageItem");
  }

  page.blueprint = options.blueprint;

  page.options = _.defaults(options, {

  });

  return page;
};

// Returns a promise that resolves to a cheerio.load result
Page.prototype.load = function(requestOptions){
  var page = this;
  //console.log("Requesting: ", requestOptions);
  return request(requestOptions)
      .spread(function (response, body) {
        if (response.statusCode !== 200) {
          throw new Error(format("[%s] %s", response.statusCode, response.request.href));
        } else {
          console.log("[%s] %s -- OK", response.statusCode, response.request.href);
        }

        return tidy(body)
            .then(function(cleanbody){
              //return cheerio.load(cleanbody.replace(/<!\[CDATA\[([^\]]+)]\]>/ig, "$1")); // Remove CDATA tags because
              return cheerio.load(cleanbody); // Remove CDATA tags because cheerio can't handle them http://stackoverflo
            });
      }).catch(function (err) {
        console.error("Error loading page: ",err);
        throw err;
      });
};

Page.prototype.extractPageItems = function($){
  var page = this,
      rows = find($,page.blueprint.itemsSelector),
      currentRowIndex = 0,
      pageItemInstances = [];

  rows.each(function(){
    var row = this,
        pageItem,
        selector,
        fieldKey;

    if(page.blueprint.skipRows.indexOf(currentRowIndex) > -1){
      //console.log("Skipping row %s",currentRowIndex);
      currentRowIndex++;
      return;
    }
    try {
      pageItem = new PageItem();
      for (fieldKey in page.blueprint.fieldSelectors){
        selector = page.blueprint.fieldSelectors[fieldKey];
        //console.log("Parsing field %s", fieldKey);
        pageItem[fieldKey] = selector.execute($, row);
      }

      //pageItem._raw = $(row).html();

      pageItemInstances.push(pageItem);
    } catch (e){
      console.warn("Error parsing row index %s: ", currentRowIndex, e.stack);
    }
    currentRowIndex++;
  });

  return pageItemInstances;
};

module.exports = Page;
