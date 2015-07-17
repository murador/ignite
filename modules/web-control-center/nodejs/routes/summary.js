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

var db = require('../db');

var router = require('express').Router();

var generatorXml = require('./generator/xml');
var generatorJava = require('./generator/java');
var generatorDocker = require('./generator/docker');

/* GET summary page. */
router.get('/', function (req, res) {
    res.render('configuration/summary');
});

router.post('/generator', function (req, res) {
    // Get cluster.
    db.Cluster.findById(req.body._id).populate('caches').exec(function (err, cluster) {
        if (err)
            return res.status(500).send(err.message);

        if (!cluster)
            return res.sendStatus(404);

        var clientCache = req.body.clientCache;

        if (clientCache)
            return res.send({
                xmlClient: generatorXml.generateClusterConfiguration(cluster, clientCache),
                javaClient: generatorJava.generateClusterConfiguration(cluster, req.body.javaClass, clientCache)
            });

        return res.send({
            xmlServer: generatorXml.generateClusterConfiguration(cluster),
            javaSnippetServer: generatorJava.generateClusterConfiguration(cluster, false),
            javaClassServer: generatorJava.generateClusterConfiguration(cluster, true),
            docker: generatorDocker.generateClusterConfiguration(cluster, '%OS%')
        });
    });
});

router.post('/download', function (req, res) {
    // Get cluster.
    db.Cluster.findById(req.body._id).populate('caches').exec(function (err, cluster) {
        if (err)
            return res.status(500).send(err.message);

        if (!cluster)
            return res.sendStatus(404);

        var clientCache = req.body.clientCache;

        var archiver = require('archiver');

        // Creating archive.
        var zip = archiver('zip');

        zip.on('error', function (err) {
            res.status(500).send({error: err.message});
        });

        // On stream closed we can end the request.
        res.on('close', function () {
            return res.status(200).send('OK').end();
        });

        // Set the archive name.
        res.attachment(cluster.name + (clientCache ? '-client' : '') + '-configuration.zip');

        var generatorCommon = require('./generator/common');

        // Send the file to the page output.
        zip.pipe(res);

        var javaClass = req.body.javaClass;

        if (!clientCache) {
            zip.append(generatorDocker.generateClusterConfiguration(cluster, req.body.os), {name: "Dockerfile"});

            var props = generatorCommon.generateProperties(cluster);

            if (props)
                zip.append(props, {name: "secret.properties"});
        }

        zip.append(generatorXml.generateClusterConfiguration(cluster, clientCache), {name: cluster.name + ".xml"})
            .append(generatorJava.generateClusterConfiguration(cluster, javaClass, clientCache),
                {name: javaClass ? 'ConfigurationFactory.java' : cluster.name + '.snipplet.java'})
            .finalize();
    });
});

module.exports = router;