var getJSON = require('get-json')
var request = require('request')
require('dotenv').config();
const { decode, encode } = require('html-entities');

var pullInterval = process.env.PULL_INTERVAL ?? 120;//how often to pull in seconds
var pullIntervalMS = pullInterval * 1000; //same but in milliseconds

var interval = setInterval (function (){
    pullFeed();
}, pullIntervalMS); // time between each interval in milliseconds

/**
 * channel mapping is expected to be this format:
 * "<id key>": {
    "webhook": "<webhook url>",
    "subreddits":["<subreddit1>", "<subreddit2>"],
    "username": "<username>",
    "avatar": "<optional url to avatar to use>"
  },
*/
const rawMapping = process.env.CHANNEL_MAPPING;
let channelMapping;
try {
  channelMapping = JSON.parse(rawMapping);
  console.log("Parsed mapping:", channelMapping);
} catch (error) {
  console.error("❌ Failed to parse CHANNEL_MAPPING environment variable.");
  console.error("➡️ Make sure it's valid JSON (e.g., '{\"project\":\"channelId\"}')");
  console.error("🧾 Actual value:", process.env.CHANNEL_MAPPING);
  process.exit(1); // Exit with a non-zero code (1 = general error)
}

function doPull(currSiteData){
(function(currSiteData){
    //pulling comments
    var subreddits = currSiteData.subreddits.join("&");
    var commentsPullUrl = "https://api.pushshift.io/reddit/comment/search?subreddit=" + subreddits + "&after=" + pullInterval + "s";
    var submissionsPullUrl = "https://api.pushshift.io/reddit/submission/search?subreddit=" + subreddits + "&after=" + pullInterval + "s";
    getJSON(commentsPullUrl, function(error, d) {
      if(!d){
          console.log("download failed for: " + commentsPullUrl)
          console.log(error);
          return;
      }
      var time = new Date().getTime();
      console.log("pulled comments for: " + commentsPullUrl + " at " + time);
      var c = d["data"]
      if(c.length == 0){
          //nothing new, don't post anything
      }
      else{
          //post everything new that was created within the last interval seconds that contains our search string
          var time = new Date().getTime();
          for(var i = 0; i < c.length; i++){
              var postText = c[i].body;
              postText = decode(postText);
              if(postText.toLowerCase().includes(process.env.SEARCH_STRING)){
                  var searchMask = process.env.SEARCH_STRING;
                  var regEx = new RegExp(searchMask, "ig");
                  var replaceMask = process.env.SEARCH_STRING;
                  postText = postText.replace(regEx, replaceMask);
                  console.log("new post: " + postText);
                  var postLink = "https://reddit.com" + c[i].permalink;
                  var author = c[i].author;
                  var message = "Mention by: " + author + "\n" + postText + "\n" + postLink;
                  request.post(currSiteData.webhook, {
                    json: {
                          "username": currSiteData.username,
                          "avatar_url": process.env.DEFAULT_AVATAR_URL,
                          "content": message
                        }
                    }, (error, res, body) => {
                      if (error) {
                        console.error(error)
                        return
                      }
                    });
              }
          }
      }
    })

    //submissions
    getJSON(submissionsPullUrl, function(error, d) {
      if(!d){
          console.log("download failed for: " + submissionsPullUrl)
          return;
      }
      var c = d["data"]
      var time = new Date().getTime();
      console.log("pulled submissions for: " + submissionsPullUrl + " at " + time);
      for(var i = 0; i < c.length; i++){
          var postText = c[i].title;
          var postURL = c[i].url;
          var selfText = c[i].selftext
          if(postText.toLowerCase().includes(process.env.SEARCH_STRING) || postURL.toLowerCase().includes(process.env.SEARCH_STRING) || selfText.toLowerCase().includes(process.env.SEARCH_STRING)){
              var searchMask = process.env.SEARCH_STRING;
              var regEx = new RegExp(searchMask, "ig");
              var replaceMask = process.env.SEARCH_STRING;
              postText = postText.replace(regEx, replaceMask);
              postURL = postURL.replace(regEx, replaceMask);
              selfText = selfText.replace(regEx, replaceMask);
              var postLink = "https://reddit.com" + c[i].permalink;
              var author = c[i].author;
              var message = "Mention by: " + author + "\n Post Title: " + postText + "\n" + postURL + "\n Post Link: " + postLink + "\n Self Text: " + selfText;
              request.post(currSiteData.webhook, {
              json: {
                    "username": currSiteData.username,
                    "avatar_url": process.env.AVATAR_URL,
                    "content": message
                  }
              }, (error, res, body) => {
                if (error) {
                  console.error(error)
                  return
                }
              });
          }
           
      }
    });
  })(currSiteData);
}

function pullFeed(){
    var idx = 0;
    for(key in channelMapping){
      //comments
      idx++;
      var currSite = channelMapping[key];
      (function(currSiteData){
        setTimeout(function(){
          doPull(currSiteData);
        }, idx * 2000);
        })(currSite);
      
    }
}