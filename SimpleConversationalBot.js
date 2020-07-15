var config = require("./config");
var botId = Object.keys(config.credentials)
var botName = config.botName;
var sdk = require("./lib/sdk");

var loadash = require('lodash');
var schedular = require('node-schedule');
var schedule, emailId;
var channels = []
var flag = 0, reqId, previousChannel = {}, previousKey = {}, previousData = {};


function schedularCallBack(requestId, data, callback) {
    console.log("Invoking the scheduler");
    sdk.extendRequestId(data, callback)
    console.log("Schedular Running")
}
function getPendingMessages(uuid, key) {
    var entities, intent;
    try {
        return sdk.getSavedData(uuid).then(function (_data) {
            entities = _data.context.entities;
            intent = _data.context.intent
            console.log("RTM entities : ", entities);
            sdk.getSavedData(key).then(function (__data) {
                __data.context.session.BotUserSession['PreEntities'] = entities;
                __data.message = intent
                console.log("1 : ", __data.message);
                return sdk.sendBotMessage(__data)
            });
        });
    } catch (ex) {
        console.log("Error in retriving data")
    }
}

function checkPreviousData() {
    if ((emailId in previousData) == false) {
        previousData[emailId] = { "previousChannel": "", previousKey: "" }
    }
}


module.exports = {
    botId: botId,
    botName: botName,

    on_user_message: function (requestId, data, callback) {
        console.log("In on_user_message")
        var channelType = loadash.get(data, 'channel.type');
        if (channelType == "rtm") {
            emailId = data.context.session.UserContext.emailId || data.context.session.UserContext.identities[0].val
            console.log("In rtm: ", emailId)
            if (channelType === "rtm") {
                if (data.channel.handle.type == "welcome" || data.message == "save") {
                    return sdk.saveChannelData(channelType + "_" + emailId, data).then(function () {
                        console.log("Saved the data");
                        schedule = schedular.scheduleJob('10 * * * * *', () => { schedularCallBack(requestId, data, callback) });
                        data.message = "Saved the data to redis.."
                        return sdk.sendUserMessage(data)
                    })
                }
                else if (data.message == "resume") {
                    var key = channelType + "_" + emailId
                    sdk.saveChannelData(key, data)
                    if (previousData[emailId]["previousChannel"] != channelType && previousData[emailId]["previousChannel"] != "") {
                        console.log("\n Before going to Pending function\n")
                        getPendingMessages(previousData[emailId]["previousKey"], key)
                        console.log("\n After coming from Pending function\n")
                    }
                    return sdk.sendBotMessage(data, callback)
                }
                else {
                    checkPreviousData(emailId)
                    return sdk.sendBotMessage(data, callback);
                }
            }
        }
        if (channelType == "email") 
        {
            emailId = data.context.session.UserContext.identities[0].val.split("/")[1] || data.channel.from.split("/")[1]
            console.log("In email: ", emailId)
            if (data.message === "save") 
            {
                return sdk.saveChannelData(channelType + "_" + emailId, data).then(function () {
                    console.log("Saved data of email channel")
                    schedule = schedular.scheduleJob('10 * * * * *', () => { schedularCallBack(requestId, data, callback) });
                    data.message = "Saved the data to redis with schedular"
                    return sdk.sendUserMessage(data)
                    // return sdk.sendBotMessage(data, callback)
                })
            }
            else if (data.message == "resume") {
                var key = channelType + "_" + emailId
                sdk.saveChannelData(key, data)
                if (previousData[emailId]["previousChannel"] != channelType && previousData[emailId]["previousChannel"] != "") {
                    console.log("\n Before going to Pending function\n")
                    getPendingMessages(previousData[emailId]["previousKey"], key)
                    console.log("\n After coming from Pending function\n")
                }
                return sdk.sendBotMessage(data, callback)
            }
            else {
                checkPreviousData(emailId)
                return sdk.sendBotMessage(data, callback)
            }
        }
        /*if ((emailId in previousData) == false) {
            previousData[emailId] = { "previousChannel": "", "previousKey": "" }
        }*/
        if (channelType.indexOf(channels) === -1 || channels.length == 0) {
            channels.push(channelType)
            reqId = requestId;
            flag = 1;
            data.message = "Hey"
            sdk.sendUserMessage(data, callback)
        }
        console.log("OnUserMsg : ", channelType, data.message);
        console.log(JSON.stringify(data))
        /*if (data.message) {
            return sdk.sendBotMessage(data, callback);
        }
        else {
            return sdk.sendBotMessage(data, callback);
        }*/
    },
    on_bot_message: function (requestId, data, callback) {
        var channelType = loadash.get(data, 'channel.type');
        console.log("OnBotMsg : ", channelType, data.message);
        var key = channelType + "_" + emailId
        sdk.saveChannelData(key, data)
        previousData[emailId] = { "previousChannel": channelType, "previousKey": key }
        console.log(previousData)
        return sdk.sendUserMessage(data, callback);
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


