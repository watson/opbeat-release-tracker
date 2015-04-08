'use strict'

var afterAll = require('after-all-results')
var Client = require('opbeat-http-client')
var git = require('./lib/git')
var pkg = require('./package')

var userAgent = pkg.name + '/' + pkg.version

var noop = function () {}

var getTracker = function (client, defaults) {
  return function track (opts, cb) {
    if (typeof opts === 'function') return track({}, opts)
    if (!opts) opts = {}
    if (!cb) cb = noop

    var cwd = opts.cwd || defaults.cwd || process.cwd()

    var next = afterAll(function (err, results) {
      if (err) return cb(err)
      opts.rev = opts.rev || results[0]
      opts.status = opts.status || 'completed'
      opts.branch = opts.branch || results[1]
      client.request('releases', opts, function (err, res, body) {
        if (err) return cb(err)
        if (res.statusCode === 202) return cb()
        if (body) {
          try {
            body = JSON.parse(body)
          } catch (e) {}
          if (body.error_message) {
            err = new Error('Opbeat API error: ' + body.error_message)
            err.status = body.status
            cb(err)
            return
          }
        }
        cb(new Error('Unexpected Opbeat HTTP status code: ' + res.statusCode))
      })
    })

    if (!opts.rev) git.rev(cwd, next())
    else process.nextTick(next())
    if (!opts.branch) git.branch(cwd, next())
    else process.nextTick(next())
  }
}

module.exports = function (opts) {
  if (!opts) opts = {}
  var defaults = { cwd: opts.cwd }
  return getTracker(Client({
    appId: opts.appId || process.env.OPBEAT_APP_ID,
    organizationId: opts.organizationId || process.env.OPBEAT_ORGANIZATION_ID,
    secretToken: opts.secretToken || process.env.OPBEAT_SECRET_TOKEN,
    userAgent: opts.userAgent || userAgent
  }), defaults)
}
