var config = require("./config");
var botId = Object.keys(config.credentials)
var botName = config.botName;
var sdk = require("./lib/sdk");

var loadash = require('lodash');
var schedular = require('node-schedule');
const ret = require("bluebird/js/release/util");
const e = require("express");
const request = require("request");
var schedule, emailId;
// var channels = []
var flag = 0, reqId, previousData = {};


function schedularCallBack(data, callback) {
    console.log("Invoking the scheduler");
    sdk.extendRequestId(data, callback)
    console.log("Schedular Running")
}
function getPendingMessages(uuid, key) {
    var entities, intent,session;
    try {
        return sdk.getSavedData(uuid).then(function (_data) {
            entities = _data.context.entities?_data.context.entities:undefined;
            intent = _data.context.intent?_data.context.intent:undefined
            session=_data.context.session.BotUserSession
            console.log("RTM entities : ", entities);
            sdk.getSavedData(key).then(function (__data) {
                if (intent ) {
                    __data.message = intent + " " + Object.values(entities).join(" ").trim();
                    console.log("1 : ", __data.message);
                    __data.context.session.BotUserSession=session
                    __data.metaInfo={
                        intentInfo:{
                            "intent":intent
                        }
                    }
                    previousData[emailId]["flag"] = 0
                    return sdk.sendBotMessage(__data)
                }
                else {
                    console.log("No data")
                    // __data.message = _data.message
                }
                // console.log("1 : ", __data.message);
                // previousData[emailId]["flag"] = 0
                // return sdk.sendBotMessage(__data)//.then(function () {
                //     if (schedule) {
                //         console.log("scheduler has been cancelled ")
                //         schedule.cancel();
                //     }
                // })
            });
        });
    } catch (ex) {
        console.log("Error in retriving data")
    }
}

function addDataToRedisAndScheduler(key, data, callback) {
    return sdk.saveChannelData(key, data).then(function () {
        console.log("Saved the data");
        schedule = schedular.scheduleJob('10 * * * * *', () => { schedularCallBack(data, callback) });
        data.message = "Saved the data to redis.."
        return sdk.sendUserMessage(data)
    })
}

function checkPreviousData() {
    if ((emailId in previousData) == false) {
        previousData[emailId] = { "previousChannel": "", "previousKey": "", "savedInRedis": [], "flag": "" }
        return 1;
    }
    return 0;
}
function updateKeyInRedis(key, data, callback) {
    if ((emailId in previousData) == false) {
        checkPreviousData(emailId)
        previousData[emailId]["savedInRedis"].push(key)
        addDataToRedisAndScheduler(key, data, callback)
    }
    else {
        var dataObjectsStoredInRedis = previousData[emailId]["savedInRedis"]
        if ((dataObjectsStoredInRedis.indexOf(key)) === -1) {
            previousData[emailId]["savedInRedis"].push(key)
            addDataToRedisAndScheduler(key, data, callback)
        }

    }
}

module.exports = {
    botId: botId,
    botName: botName,

    on_user_message: function (requestId, data, callback) {
        console.log("In on_user_message")
        var channelType = loadash.get(data, 'channel.type');
        var key,email;
        if (channelType == "rtm")
        {
            email=loadash.get(data,'context.session.UserContext.emailId')
            if(email===undefined)
                 email=loadash.get(data,'context.session.UserContext.identities[0].val')
        }
        if (channelType == "email")
        {
            var email=loadash.get(data,'context.session.UserContext.identities[0].val.split("/")[1]')
            if(email===undefined)
                email=loadash.get(data,'data.channel.from.split("/")[1]')
        }
        emailId=email
        if (channelType == "msteams")
            emailId = "ujwal.tadur@kore.com"
        key = channelType + "_" + emailId
        if (channelType == "facebook") {
            console.log(data.channel.userId)
            // emailId="ujwal.tadur@kore.com"
            key = channelType + "_" + data.channel.userId 
        }

        updateKeyInRedis(key, data, callback)
        previousData[emailId]["flag"] = 1
        return sdk.sendBotMessage(data)
    },
    on_bot_message: function (requestId, data, callback) {
        if (previousData[emailId]["flag"] == 1) {
            var channelType = loadash.get(data, 'channel.type');
            console.log("OnBotMsg : ", channelType, data.message);
            var key = channelType + "_" + emailId
            sdk.saveChannelData(key, data)
            var keysInRedis = previousData[emailId]["savedInRedis"]
            console.log("Keys in Redis ", JSON.stringify(keysInRedis))
            for (var i = 0; i < keysInRedis.length && keysInRedis.length > 1; i++) {
                var previousKey = previousData[emailId]["previousKey"]
                if (previousKey != "") {
                    if (previousKey != key) {
                        getPendingMessages(previousKey, keysInRedis[i])
                    }
                    else {
                        getPendingMessages(key, keysInRedis[i])
                    }
                }
            }
            previousData[emailId]["previousKey"] = key
            // if(previousData[emailId]["previousChannel"]!=channelType&&previousData[emailId]["previousChannel"]!=""){    
            //     getPendingMessages(previousData[emailId]["previousKey"],key)
            // }
            // previousData[emailId] = { "previousChannel": channelType, "previousKey": key }
            console.log(previousData)
            // sdk.saveData(data,callback)
            return sdk.sendUserMessage(data, callback);
        }
        else {
            console.log("In else")
            return sdk.sendUserMessage(data, callback);
        }
    },
    on_agent_transfer: function (requestId, data, callback) {
        return callback(null, data);

    },
    on_event: function (requestId, data, callback) {
        console.log("on_event -->  Event : ", data.event);
        return callback(null, data);
    },
    on_alert: function (requestId, data, callback) {
        console.log("on_alert -->  : ", data, data.message);
        return sdk.sendAlertMessage(data, callback);
    }
};


