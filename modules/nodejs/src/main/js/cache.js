/*
 * Licensed to the Apache Software Foundation (ASF) under one or more
 * contributor license agreements.  See the NOTICE file distributed with
 * this work for additional information regarding copyright ownership.
 * The ASF licenses this file to You under the Apache License, Version 2.0
 * (the "License"); you may not use this file except in compliance with
 * the License.  You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

var Server = require("./server").Server;
var Command = require("./server").Command;
var SqlFieldsQuery = require("./sql-fields-query").SqlFieldsQuery
var SqlQuery = require("./sql-query").SqlQuery

/**
 * Creates an instance of Cache
 *
 * @constructor
 * @this {Cache}
 * @param {Server} server Server class
 * @param {string} cacheName Cache name
 */
function Cache(server, cacheName) {
    this._server = server;
    this._cacheName = cacheName;
}

/**
 * Get cache value
 *
 * @this {Cache}
 * @param {string} key Key
 * @param {onGet} callback Called on finish
 */
Cache.prototype.get = function(key, callback) {
    this._server.runCommand(this._createCommand("get").
        setPostData(JSON.stringify({"key": key})),
        callback);
};

/**
 * Put cache value
 *
 * @this {Cache}
 * @param {string} key Key
 * @param {string} value Value
 * @param {noValue} callback Called on finish
 */
Cache.prototype.put = function(key, value, callback) {
    this._server.runCommand(this._createCommand("put").
        setPostData(JSON.stringify({"key": key, "val" : value})),
        callback);
}

/**
 * Put if absent
 *
 * @this {Cache}
 * @param {string} key Key
 * @param {string} value Value
 * @param {onGet} callback Called on finish
 */
Cache.prototype.putIfAbsent = function(key, value, callback) {
    this._server.runCommand(this._createCommand("putifabsent").
        setPostData(JSON.stringify({"key": key, "val" : value})),
        callback);
}

/**
 * Remove cache key
 *
 * @this {Cache}
 * @param {string} key Key
 * @param {noValue} callback Called on finish
 */
Cache.prototype.remove = function(key, callback) {
    this._server.runCommand(this._createCommand("rmv").
        setPostData(JSON.stringify({"key": key})),
        callback);
}

/**
 * Get and remove cache key
 *
 * @this {Cache}
 * @param {string} key Key
 * @param {onGet} callback Called on finish with previous value
 */
Cache.prototype.getAndRemove = function(key, callback) {
    this._server.runCommand(this._createCommand("getandrmv").
        setPostData(JSON.stringify({"key": key})),
        callback);
}

/**
 * Remove cache keys
 *
 * @this {Cache}
 * @param {string[]} keys Keys to remove
 * @param {noValue} callback Called on finish
 */
Cache.prototype.removeAll = function(keys, callback) {
    this._server.runCommand(this._createCommand("rmvall").
        setPostData(JSON.stringify({"keys" : keys})),
        callback);
}

/**
 * Put keys to cache
 *
 * @this {Cache}
 * @param {Entry[]} List of entries to put in the cache
 * @param {noValue} callback Called on finish
 */
Cache.prototype.putAll = function(entries, callback) {
    this._server.runCommand(this._createCommand("putall").setPostData(
        JSON.stringify({"entries" : entries})), callback);
}

/**
 * Get keys from the cache
 *
 * @this {Cache}
 * @param {Object[]} keys Keys
 * @param {Cache~onGetAll} callback Called on finish
 */
Cache.prototype.getAll = function(keys, callback) {
    function onGetAll(callback, err, res) {
        if (err) {
            callback.call(null, err, null);

            return;
        }

        var result = [];

        for (var key of res) {
            result.push(new Entry(key["key"], key["value"]));
        }

        callback.call(null, null, result);
    }

    this._server.runCommand(this._createCommand("getall").setPostData(
        JSON.stringify({"keys" : keys})),
        onGetAll.bind(null, callback));
}

/**
 * Determines if the cache contains an entry for the specified key.
 *
 * @this {Cache}
 * @param {Object} key Key
 * @param {Cache~onGetAll} callback Called on finish with boolean result
 */
Cache.prototype.containsKey = function(key, callback) {
    this._server.runCommand(this._createCommand("containskey").
        setPostData(JSON.stringify({"key" : key})), callback);
}

/**
 * Determines if the cache contains all keys.
 *
 * @this {Cache}
 * @param {Object[]} keys Keys
 * @param {Cache~onGetAll} callback Called on finish with boolean result
 */
Cache.prototype.containsKeys = function(keys, callback) {
    this._server.runCommand(this._createCommand("containskeys").
        setPostData(JSON.stringify({"keys" : keys})), callback);
}

/**
 * Get and put cache value
 *
 * @this {Cache}
 * @param {string} key Key
 * @param {string} value Value
 * @param {onGet} callback Called on finish
 */
Cache.prototype.getAndPut = function(key, val, callback) {
    this._server.runCommand(this._createCommand("getandput").
        setPostData(JSON.stringify({"key" : key, "val" : val})), callback);
}

/**
 * Stores given key-value pair in cache only if cache had no previous mapping for it.
 *
 * @this {Cache}
 * @param {string} key Key
 * @param {string} value Value
 * @param {onGet} callback Called on finish
 */
Cache.prototype.getAndPutIfAbsent = function(key, val, callback) {
    this._server.runCommand(this._createCommand("getandputifabsent").
        setPostData(JSON.stringify({"key" : key, "val" : val})), callback);
}

/**
 * Execute sql query
 *
 * @param {SqlQuery|SqlFieldsQuery} qry Query
 */
Cache.prototype.query = function(qry) {
    function onQueryExecute(qry, error, res) {
        if (error !== null) {
            qry.end(error);

            return;
        }

        qry.page(res["items"]);

        if (res["last"]) {
            qry.end(null);
        }
        else {
            var command = this._createCommand("qryfetch");

            command.addParam("qryId", res.queryId).addParam("psz", qry.pageSize());

            this._server.runCommand(command, onQueryExecute.bind(this, qry));
        }
    }

    if (qry.type() === "Sql") {
        this._sqlQuery(qry, onQueryExecute);
    }
    else {
        this._sqlFieldsQuery(qry, onQueryExecute);
    }
}

Cache.prototype._sqlFieldsQuery = function(qry, onQueryExecute) {
    var command = this._createQueryCommand("qryfieldsexecute", qry);

    command.setPostData(JSON.stringify({"arg" : qry.arguments()}));

    this._server.runCommand(command, onQueryExecute.bind(this, qry));
}

Cache.prototype._sqlQuery = function(qry, onQueryExecute) {
    if (qry.returnType() == null) {
        qry.end("No type for sql query.");

        return;
    }

    var command = this._createQueryCommand("qryexecute", qry);

    command.addParam("type", qry.returnType());

    command.setPostData(JSON.stringify({"arg" : qry.arguments()}));

    this._server.runCommand(command, onQueryExecute.bind(this, qry));
}

Cache.prototype._createCommand = function(name) {
    var command = new Command(name);

    return command.addParam("cacheName", this._cacheName);
}

Cache.prototype._createQueryCommand = function(name, qry) {
    var command = this._createCommand(name);

    command.addParam("qry", qry.query());

    return command.addParam("psz", qry.pageSize());
}

/**
 * @this{Entry}
 * @param key Key
 * @param val Value
 */
function Entry(key, val) {
    this._key = key;
    this._val = val;
}

/**
 * @this{Entry}
 * @returns Key
  */
Entry.prototype.key = function() {
    return this._key;
}

/**
 * @this{Entry}
 * @returns Value
 */
Entry.prototype.val = function() {
    return this._val;
}

/**
 * Callback for cache get
 *
 * @callback Cache~onGetAll
 * @param {string} error Error
 * @param {string[]} results Result values
 */

exports.Cache = Cache
exports.Entry = Entry