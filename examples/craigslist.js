// This example demonstrates how to define a Blueprint in CerealScraper and then executing the scrape job
'use strict';
var CerealScraper = require('../index'),
    TextSelector = CerealScraper.Blueprint.TextSelector,
    ConstantSelector = CerealScraper.Blueprint.ConstantSelector,
    TransformSelector = CerealScraper.Blueprint.TransformSelector,
    Promise = require('bluebird');

var blueprint = new CerealScraper.Blueprint({
    requestTemplate: { // The page request options -- see https://www.npmjs.com/package/request
        method: 'GET',
        uri: 'http://hongkong.craigslist.hk/search/apa', // This is an example only, please do not abuse!
        qs: {}
    },
    itemsSelector: '.content .row', // jQuery style selector to select the row elements
    skipRows: [], // we don't want these rows
    // Our model fields and their associated jQuery selectors -- extend your own by overriding Blueprint.Selector.prototype.execute($, context)
    // In this example the data model represents a craigslist apartment/housing listing
    fieldSelectors: {
        type: new ConstantSelector('rent'),
        title: new TextSelector('.pl a', 0),
        // Transform selectors can be used to manipulate the extracted field using the original jQuery element
        postDate: new TransformSelector('.pl time', 0, function(el){
            return new Date(el.attr('datetime'));
        }),
        location: new TransformSelector('.pnr small', 0, function(el){
            return el.text().replace("(", "").replace(")", "");
        }),
        buildAreaSqFt: new TransformSelector('.housing', 0, function(el){
            var rPrefix = /[^-]*- /,
                rSuffix = /m.*/,
                sizeString = el.text(),
                prefix = rPrefix.exec(sizeString),
                suffix = rSuffix.exec(sizeString),
                sizeM2;

            prefix = (prefix)? prefix[0] : "";
            suffix = (suffix)? suffix[0] : "";

            sizeString = sizeString.replace(prefix, "");
            sizeString = sizeString.replace(suffix, "");
            sizeString = sizeString.trim();
            sizeM2 = parseFloat(sizeString);

            if(!sizeM2){
                return null
            } else {
                return sizeM2 * 3.28084; // m to ft
            }
        }),
        priceHkd: new TransformSelector('.price', 0, function(el){
            return parseFloat(el.text().replace('$',''));
        }),
    },
    // The itemProcessor is where you do something with the extracted PageItem instance, e.g. save the data or run some deeper scraping tasks
    itemProcessor: function(pageItem){
        return new Promise(function(resolve, reject){
            console.log(pageItem);
            resolve();
        });
    },
    // The paginator method -- construct and return the next request options, or return null to indicate there are no more pages to request
    getNextRequestOptions: function(){
        var dispatcher = this,
            pagesToLoad = 2,
            rowsPerPage = 100,
            requestOptions = dispatcher.blueprint.requestTemplate;

        dispatcher.pagesRequested = (dispatcher.pagesRequested === undefined)? 0 : dispatcher.pagesRequested;
        dispatcher.pagesRequested++;
        if (dispatcher.pagesRequested > pagesToLoad){
            return null;
        } else {
            requestOptions.qs['s'] = dispatcher.pagesRequested * rowsPerPage - rowsPerPage; // s is the query string Craigslist uses to paginate
            return requestOptions;
        }
    },
    // Set the following to false to wait for one page to finish processing before scraping the next
    parallelRequests: true,
    // The rate limit for making page requests. See https://www.npmjs.com/package/limiter
    requestLimiterOptions: {requests: 1, perUnit: 'second'},
    // The rate limit for calling PageItem#_process(), i.e. your `itemProcessor()` method
    processLimiterOptions: {requests: 100, perUnit: "second"}
});

// Setup the scraper by creating a dispatcher with your blueprint
var dispatcher = new CerealScraper.Dispatcher(blueprint);

// Start the scraping!
dispatcher.start()
    .then(function(){
        console.log("End of the craigslist example.");
    });
