const { Client, GatewayIntentBits, Collection } = require("discord.js");
const fs = require("fs");
const path = require("path");
const express = require("express");

const VOYAGES_CHANNEL_ID = "1519404986079903854";
const BOTS_CHANNEL_ID = "1518998081713213520";

/* ---------------- ROLE SALARIES ---------------- */

const ROLE_SALARIES = {
  groundCrew: "1520435967264292944",
  firstOfficer: "1519410229744504963",
  captain: "1519409864185614467",
  admin: "1519406529495961873",
  owner: "1519408960803700948",
  passenger: "1519410590458576907",
  trainee: "1521132303454048296",
  gcTrainee: "1521133652963098717"
};

const SALARY_INTERVAL = 1000 * 60 * 60 * 24 * 30; // 30 days

/* ---------------- KEEP ALIVE ---------------- */

const app = express();
const PORT = process.env.PORT || 3000;

app.get("/", (req, res) => res.send("RO-12 bot is live"));
app.listen(PORT, "0.0.0.0", () =>
  console.log(`Server running on port ${PORT}`)
);

/* ---------------- CLIENT ---------------- */

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
  ],
});

const TOKEN = process.env.TOKEN;

/* ---------------- DATA ---------------- */

function loadData() {
  try {
    if (!fs.existsSync("data.json")) {
      return {
        users: {},
        voyages: {},
        voyageIdCounter: 1,
        lastSalaryRun: 0
      };
    }
    return JSON.parse(fs.readFileSync("data.json", "utf8"));
  } catch {
    return {
      users: {},
      voyages: {},
      voyageIdCounter: 1,
      lastSalaryRun: 0
    };
  }
}

let data = loadData();
let voyages = data.voyages || {};
let voyageIdCounter = data.voyageIdCounter || 1;

/* safety sync */
data.voyages = voyages;
data.voyageIdCounter = voyageIdCounter;

data.lastSalaryRun = data.lastSalaryRun || 0;

/* ---------------- SAVE ---------------- */

function saveData() {
  data.users = data.users || {};
  data.voyages = voyages;
  data.voyageIdCounter = voyageIdCounter;
  data.lastSalaryRun = data.lastSalaryRun || 0;

  fs.writeFileSync("data.json", JSON.stringify(data, null, 2));
}

/* ---------------- USER ---------------- */

function getUser(id) {
  if (!data.users[id]) {
    data.users[id] = {
      balance: 250,
      seat: null,
      cabin: null,
      firstSeen: Date.now(),
      travelHistory: []
    };
    saveData();
  }
  return data.users[id];
}

/* ---------------- SLASH COMMANDS ---------------- */

client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  if (interaction.channelId !== BOTS_CHANNEL_ID) {
    return interaction.reply({ content: "❌ Use #bots channel for commands.", ephemeral: true });
  }

  const command = commands.get(interaction.commandName);
  if (!command) return;

  try {
    await command.execute(interaction, {
      getUser,
      data,
      voyages,
      saveData
    });
  } catch (err) {
    console.error(err);
    interaction.reply({ content: "❌ Command error", ephemeral: true });
  }
});

/* ---------------- MESSAGE COMMANDS ---------------- */

client.on("messageCreate", async (message) => {
  if (message.author.bot) return;
  if (message.channel.id !== BOTS_CHANNEL_ID) return;

  const content = message.content;
  const user = getUser(message.author.id);

  if (content === "!balance") {
    return message.reply(`💰 Your balance: $${user.balance}`);
  }

  if (content === "!ping") {
    const sent = await message.channel.send("🏓 Pong!");
    const latency = sent.createdTimestamp - message.createdTimestamp;
    const apiPing = Math.round(client.ws.ping);

    return sent.edit(`🏓 Pong!\n⏱️ Latency: ${latency}ms\n📡 API: ${apiPing}ms`);
  }

  // (rest unchanged)
});

if (!process.env.TOKEN) {
  console.log("❌ TOKEN missing");
} else {
  console.log("✅️ TOKEN EXISTS:", true);

  client.login(process.env.TOKEN)
    .then(() => console.log("✅️ Logged in as", client.user.tag))
    .catch(err => console.error("❌ Login error:", err));
}