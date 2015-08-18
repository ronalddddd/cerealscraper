// A blueprint defines the configs for scraping
'use strict';
var _ = require('lodash'),
    Promise = require('bluebird');

var Blueprint = function(options){
  var blueprint = this;
  options = options || {};
  // OPTIONS:
  // requestTemplate -- default options for each page request -- see https://www.npmjs.com/package/request
  // itemsSelector -- the jQuery selector for finding the rows on each page
  // skipRows -- the row indexes to skip
  // fieldSelectors -- dictionary of Blueprint.Selector instances -- e.g. { title: new Blueprint.Selector('span.title') }
  // itemProcessor() --  the async item processor method -- use it to do things like saving the item to a database.
  // getNextRequestOptions() -- the "paginator" that returns the set of request options for the next page. This is used by the dispatcher.
  // parallelRequests -- if set to true, calls to `Page#load` will be executed in parallel without waiting for each one to be resolved.
  // requestLimiterOptions -- rate limit the requests made -- default: `{requests: 5, perUnit: "second"}` -- see https://www.npmjs.com/package/limiter
  // processLimiterOptions -- rate limit the number of items to process -- default: `{requests: 100, perUnit: "second"}` -- see https://www.npmjs.com/package/limiter

  options = _.defaults(options, {
    requestTemplate: {
      method: "GET",
      url: "http://localhost"
    },
    itemsSelector: "p",
    skipRows: [],
    fieldSelectors: {},
    // The default implementation of `itemProcessor` just prints out the PageItem instance
    itemProcessor: function(){
      var item = this; // Runs using the PageItem instance scope
      return new Promise(function(resolve, reject){
        // console.log("Item: ", item);
        resolve(item);
      });
    },
    // The default implementation of `getNextRequestOptions` only scrapes a single page
    getNextRequestOptions: function getNextRequestOptions(){
      var dispatcher = this, // `getNextRequestOptions` is run using the dispatcher instance's scope
          done = dispatcher.done;

      if (done){
        return null;
      } else {
        dispatcher.done = true;
        return dispatcher.blueprint.requestTemplate;
      }
    },
    parallelRequests: true,
    requestLimiterOptions: {requests: 5, perUnit: "second"},
    processLimiterOptions: {requests: 100, perUnit: "second"}
  });

  blueprint.requestTemplate = options.requestTemplate;
  blueprint.itemsSelector = options.itemsSelector;
  blueprint.skipRows = options.skipRows;
  blueprint.fieldSelectors = options.fieldSelectors;
  blueprint.itemProcessor = options.itemProcessor;
  blueprint.getNextRequestOptions = options.getNextRequestOptions;
  blueprint.requestLimiterOptions = options.requestLimiterOptions;
  blueprint.processLimiterOptions = options.processLimiterOptions;
  blueprint.parallelRequests = options.parallelRequests;

  return blueprint;
};

// Basic Selector object -- cheerio selector
Blueprint.Selector = function(query, index){
  var selector = this;
  selector.query = query;
  selector.index = index || 0;
  return selector;
};

Blueprint.Selector.prototype.execute = function($, context){
  var selector = this,
      results = $(context).find(selector.query),
      el = results.eq(selector.index);
  return el;
};

// Text selector
Blueprint.TextSelector = function(){
  return Blueprint.Selector.apply(this, arguments);
};

Blueprint.TextSelector.prototype = _.create(Blueprint.Selector,{
  'constructor': Blueprint.TextSelector,
  'execute': function(){ return Blueprint.Selector.prototype.execute.apply(this, arguments).text(); }
});

// A fake selector that just returns a constant
Blueprint.ConstantSelector = function(val) {
  var selector = this;
  selector.constant = val;
  return selector;
};

Blueprint.ConstantSelector.prototype = _.create(Blueprint.Selector, {
  'constructor': Blueprint.ConstantSelector,
  'execute': function(){ return this.constant }
});

// A selector that applies a transformation
Blueprint.TransformSelector = function(query, index, transformMethod){
  var selector = this;
  selector.query = query;
  selector.index = index || 0;
  selector.transform = transformMethod;
  return selector;
};

Blueprint.TransformSelector.prototype = _.create(Blueprint.Selector, {
  'constructor': Blueprint.TransformSelector,
  'execute': function($, context){
    var selector = this;
    return selector.transform(Blueprint.Selector.prototype.execute.apply(selector, arguments)); // transform the extracted value
  }
});

Blueprint.RawSelector = function RawSelector(executeMethod){
  var selector = this;
  selector.executeMethod = executeMethod;
  return selector;
};

Blueprint.RawSelector.prototype = _.create(Blueprint.Selector, {
  'constructor': Blueprint.RawSelector,
  'execute': function($, context){
    var selector = this;
    return selector.executeMethod($, context);
  }
});

module.exports = Blueprint;
