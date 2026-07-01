const { Client, GatewayIntentBits, Collection } = require("discord.js");
const fs = require("fs");
const path = require("path");
const express = require("express");

const VOYAGES_CHANNEL_ID = "1519404986079903854";
const BOTS_CHANNEL_ID = "1518998081713213520";
const STAFF_CHANNEL_ID = "1519551586999730236";
const SENIOR_CAPTAIN_ROLE = "1521172459385126922";

const ROLE_SALARIES = {
  groundCrew: "1520435967264292944",
  firstOfficer: "1519410229744504963",
  captain: "1519409864185614467",
  admin: "1519406529495961873",
  owner: "1519408960803700948"
};

const app = express();
const PORT = process.env.PORT || 3000;
app.get("/", (req, res) => res.send("RO-12 bot is live"));
app.listen(PORT, "0.0.0.0", () => console.log(`Server running on port ${PORT}`));

const client = new Client({ intents:[GatewayIntentBits.Guilds,GatewayIntentBits.GuildMessages,GatewayIntentBits.MessageContent,GatewayIntentBits.GuildMembers]});
const TOKEN=process.env.TOKEN;
function loadData(){try{if(!fs.existsSync("data.json")){return {users:{},voyages:{},voyageIdCounter:1,lastSalaryRun:0};}return JSON.parse(fs.readFileSync("data.json","utf8"));}catch{return {users:{},voyages:{},voyageIdCounter:1,lastSalaryRun:0};}}
let data=loadData();let voyages=data.voyages||{};let voyageIdCounter=data.voyageIdCounter||1;function saveData(){data.users=data.users||{};data.voyages=voyages;data.voyageIdCounter=voyageIdCounter;fs.writeFileSync("data.json",JSON.stringify(data,null,2));}function getUser(id){if(!data.users[id]){data.users[id]={balance:250,seat:null,cabin:null,travelHistory:[]};saveData();}return data.users[id];}
client.on("messageCreate",async(message)=>{if(message.author.bot)return;const content=message.content;const member=message.member;const channelId=message.channel.id;const has=(id)=>member?.roles?.cache?.has(id);if(channelId===BOTS_CHANNEL_ID){if(content==="!ping"){const sent=await message.channel.send("🏓 Pong!");const latency=sent.createdTimestamp-message.createdTimestamp;const apiPing=Math.round(client.ws.ping);return sent.edit(`🏓 Pong!\n⏱️ ${latency}ms\n📡 ${apiPing}ms`);}if(content==="!balance"){const u=getUser(message.author.id);return message.reply(`💰 Your balance: $${u.balance}`);}}if(channelId!==STAFF_CHANNEL_ID)return;if(content.startsWith("!setvoyage")){const allowed=has("1519409864185614467")||has(SENIOR_CAPTAIN_ROLE)||has("1519406529495961873")||has("1519408960803700948");if(!allowed)return message.reply("❌ No permission.");return;}if(content.startsWith("!cancelvoyage")){const allowed=has(SENIOR_CAPTAIN_ROLE)||has("1519406529495961873")||has("1519408960803700948");if(!allowed)return message.reply("❌ No permission.");return;}if(content.startsWith("!claim")){return;}});if(process.env.TOKEN){client.login(process.env.TOKEN);}