# Overview

CerealScraper is a library that provides a structured approach to your web scraping projects.

The goal is to reduce the time spent writing boilerplate code for scraping and processing listing-type web pages.

It is essentially glue code for the popular libraries used to do scraping in node, such as [request](https://www.npmjs.com/package/request) and [Cheerio](https://www.npmjs.com/package/cheerio).


# Features

- scrape listing-type pages
- jQuery selectors using [Cheerio](https://www.npmjs.com/package/cheerio)
- http requests are made using [request](https://www.npmjs.com/package/request)
- custom paginator method
- promise-based, custom page item processing method (e.g. save to a database, do deeper scraping, etc)
- parallel or sequential page requests
- rate limit page requests
- rate limit page item processing tasks

# Quick start

This example scrapes Craigslist for apartment rent listings, applies some transformation to the extracted fields and then finally outputs each item to the console.

```javascript
// This example demonstrates how to define a Blueprint in CerealScraper and then executing the scrape job
'use strict';
var CerealScraper = require('cerealscraper'),
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
```

See the `examples/` directory for more commented usage examples.


# Concept

A "blueprint" is used to define your data source, e.g. Hong Kong Craigslist's apartment listings. 
A dispatcher takes a blueprint and executes the scrape job, which involves calling `request()` until `getNextRequestOptions()` returns null.
Every page is then parsed by the `fieldSelectors` and then processed by the `itemProcessor` method.
`request` and `itemProcessor` calls are rate limited by the `requestLimiterOptions` and `processLimiterOptions`. 
The blueprint consist of the following configurations:

## requestTemplate

The `requestTemplate` is the options object for [request](https://www.npmjs.com/package/request). 
This will be used to call the request method for each page. You will have a chance to edit this object during every call to the `getNextRequestOptions()` paginator method. 

## itemsSelector

The `itemSelector` is the jQuery selector to extract the row items from the page.

## skipRows

This is used to skip unwanted items selected by the `itemsSelector`, e.g. if you're extracting items from a table `tr`, there might be rows that are irrelevant to the model you're extracting.

## fieldSelectors

The `fieldSelectors` defines your target object model, i.e. in this example an apartment listing. 
Each property of this object should map to a `Blueprint.Selector` or any subclasses of it:

- Blueprint.TextSelector
- Blueprint.TransformSelector
- Blueprint.ConstantSelector

The quickstart example above demonstrates each of their uses.

## itemProcessor

This method `function(item){}` is passed the resulting target object that has been created using the field selectors. 
Do your post processing and saving here. It must return a promise that resolves to indicate you're done processing the item. 
For projects that have multiple scrape sources (blueprints), you can consider sharing the same itemProcessor by making sure your fieldSelectors produce the same item object format.  

## getNextRequestOptions

This method `function(){}` is called by the dispatcher to get the next set of `request` options. 
You can use the `this` object to save state information like that shown in the quickstart example. Also the request template can be accessed via `this.blueprint.requestTemplate`.
The most common use case would be to copy the requestTemplate object and set the next page parameter.

