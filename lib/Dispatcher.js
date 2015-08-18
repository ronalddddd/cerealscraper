// The dispatcher handles the execution of page loads, extract page items, page item storage and rate limiting actions.
'use strict';
var Promise = require('bluebird'),
    RateLimiter = require('limiter').RateLimiter,
    Blueprint = require('./Blueprint'),
    Page = require('./Page'),
    PageItem = require('./PageItem');

var Dispatcher = function(blueprint){
    if(!blueprint || !(blueprint instanceof Blueprint)){
        throw new Error("Missing or Invalid blueprint");
    }

    var dispatcher = this;
    dispatcher.blueprint = blueprint;
    dispatcher.done = false;
    dispatcher.pagesLoaded = 0;
    dispatcher.pagesExtracted = 0;
    dispatcher.itemsProcessed = 0;
    dispatcher.pageLoadLimiter = new RateLimiter(blueprint.requestLimiterOptions.requests, blueprint.requestLimiterOptions.perUnit);
    dispatcher.itemProcessorLimiter = new RateLimiter(blueprint.processLimiterOptions.requests, blueprint.processLimiterOptions.perUnit);
    dispatcher.getNextRequestOptions = blueprint.getNextRequestOptions;
    dispatcher.extractedItems = [];
    dispatcher.pageLoadPromises = [];
    dispatcher.itemProcessPromises = [];
};

// keep processing items until Dispatcher#extractedItems is empty
Dispatcher.prototype.processNextItem = function(resolve, reject){
    var dispatcher = this,
        item,
        processPromise;

    if(!resolve && !reject){
        // bootstrap a new promise
        return new Promise(function(resolve, reject){
            dispatcher.processNextItem(resolve, reject);
        });
    }

    item = dispatcher.extractedItems.pop();

    if (item){
        dispatcher.itemProcessorLimiter.removeTokens(1, function(){
            processPromise = dispatcher.blueprint.itemProcessor(item);
            dispatcher.itemProcessPromises.push(processPromise);
            dispatcher.itemsProcessed++;
            dispatcher.processNextItem(resolve, reject);
        });
    } else {
        //console.log("Items queue is emptied, waiting them to finish processing...");
        Promise.all(dispatcher.itemProcessPromises)
            .then(function(){
                console.log("Processed %s items.", dispatcher.itemsProcessed);
                resolve();
            });
    }
};

// keep loading pages until Dispatcher#getNextRequestOptions() returns null
Dispatcher.prototype.loadNextPage = function(resolve, reject){
    //console.log('loadNextPage()');
    var dispatcher = this,
        page = new Page({blueprint: dispatcher.blueprint}),
        requestOptions,
        loadPromise;

    if(!resolve && !reject){
        // bootstrap a new promise
        //console.log('Starting a new loadNextPage chain...');
        return new Promise(function(resolve, reject){
            dispatcher.loadNextPage(resolve, reject);
        });
    }

    requestOptions = dispatcher.getNextRequestOptions();

    if(requestOptions){
        dispatcher.pageLoadLimiter.removeTokens(1, function(){
            //console.log('Making request: ', requestOptions);
            console.log('Requesting next page...');
            loadPromise = page.load(requestOptions)
                .then(function($){
                    dispatcher.extractedItems = dispatcher.extractedItems.concat(page.extractPageItems($));
                    console.log('%s items extracted', dispatcher.extractedItems.length);
                    dispatcher.pagesLoaded++;
                    return dispatcher.processNextItem(); // "loadPromise" here means the page is loaded and the batch of page items extracted are processed
                });
            dispatcher.pageLoadPromises.push(loadPromise);

            if (dispatcher.blueprint.parallelRequests){
                // Parallel page scraping
                //console.log("parallel scraping...");
                dispatcher.loadNextPage(resolve, reject);
            } else {
                // Sequential page scraping
                //console.log("sequential scraping...");
                loadPromise.then(function(){
                    dispatcher.loadNextPage(resolve, reject);
                });
            }
        });
    } else { // no more pages to load
        console.log("No more pages to load, waiting them to finish loading...");
        Promise.all(dispatcher.pageLoadPromises)
            .then(function(){
                console.log("All pages finished loading.");
                resolve();
            });
    }
};

// Start the scraping
Dispatcher.prototype.start = function(){
    var dispatcher = this;

    return dispatcher.loadNextPage()
        .then(function(){
            console.log("All pages and items loaded and processed.");
        });
};

module.exports = Dispatcher;
