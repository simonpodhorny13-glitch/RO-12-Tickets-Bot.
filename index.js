const { Client, GatewayIntentBits, Collection } = require("discord.js");
const fs = require("fs");
const express = require("express");
const VOYAGES_CHANNEL_ID = "1519404986079903854";

/* ---------------- KEEP ALIVE ---------------- */

const app = express();
const PORT = process.env.PORT || 3000;

app.get("/", (req, res) => res.send("RO-12 bot is alive"));
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

let data = loadData();

/* MULTI VOYAGE STORAGE */
let voyages = data.voyages || {};
let voyageIdCounter = data.voyageIdCounter || 1;

/* ---------------- FILE ---------------- */

function loadData() {
  try {
    if (!fs.existsSync("data.json")) {
      return {
        users: {},
        seatMap: {},
        cabinMap: {},
        voyages: {},
        voyageIdCounter: 1
      };
    }
    return JSON.parse(fs.readFileSync("data.json", "utf8"));
  } catch {
    return {
      users: {},
      seatMap: {},
      cabinMap: {},
      voyages: {},
      voyageIdCounter: 1
    };
  }
}

function saveData() {
  data.voyages = voyages;
  data.voyageIdCounter = voyageIdCounter;

  fs.writeFileSync("data.json", JSON.stringify(data, null, 2));
}

/* ---------------- USER ---------------- */

function getUser(id) {
  if (!data.users[id]) {
    data.users[id] = {
      balance: 250,
      seat: null,
      cabin: null
    };
    saveData();
  }
  return data.users[id];
}

/* ---------------- UTILS ---------------- */

function isValidSeat(seat) {
  return /^([1-9]|1[0-9]|20)[A-F]$/.test(seat);
}

function getRouteData(code) {
  if (code === "1") return { name: "Short", multiplier: 1 };
  if (code === "2") return { name: "Medium", multiplier: 1.5 };
  if (code === "3") return { name: "Long", multiplier: 2 };
  return { name: "Unknown", multiplier: 1 };
}

function getBasePrice(multiplier = 1) {
  return 50 * multiplier;
}

/* ---------------- COMMAND SYSTEM ---------------- */

const commands = new Collection();

try {
  const commandFiles = fs.readdirSync("./commands");
  for (const file of commandFiles) {
    const cmd = require(`./commands/${file}`);
    commands.set(cmd.name, cmd);
  }
} catch (e) {
  console.log("No commands folder or error loading commands");
}

/* ---------------- SLASH COMMANDS ---------------- */

client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

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
    interaction.reply({
      content: "❌ Command error",
      ephemeral: true
    });
  }
});

/* ---------------- MESSAGE COMMANDS ---------------- */

client.on("messageCreate", async (message) => {
  if (message.author.bot) return;

  const content = message.content;
  const channel = message.channel.name;
  const user = getUser(message.author.id);

  const hasPermission = message.member?.roles.cache.some((r) =>
    ["Owner", "Admin", "Captain"].includes(r.name)
  );

  /* ---------------- BALANCE ---------------- */
  if (content === "!balance") {
    return message.reply(`💰 Your balance: $${user.balance}`);
  }

  /* ---------------- MAP ---------------- */
  if (content === "!map cabins") {
    const isTaken = (id) => (data.cabinMap[id] ? "[X]" : "[ ]");

    return message.channel.send(
      `🛏️ CABINS\n\n` +
      `ECONOMY\n1A ${isTaken("1A")} 1B ${isTaken("1B")} 2A ${isTaken("2A")} 2B ${isTaken("2B")}\n\n` +
      `FIRST\n1C ${isTaken("1C")} 1D ${isTaken("1D")} 2C ${isTaken("2C")} 2D ${isTaken("2D")}\n\n` +
      `DOUBLE\n3A ${isTaken("3A")} 3B ${isTaken("3B")} 3C ${isTaken("3C")} 3D ${isTaken("3D")}`
    );
  }

  /* ---------------- SET VOYAGE ---------------- */
  if (content.startsWith("!setvoyage")) {
    if (channel !== "staff") return;

    const parts = content.split(" ");
    const from = parts[1];
    const to = parts[2];
    const routeCode = parts[3];

    const route = getRouteData(routeCode);

    const id = String(voyageIdCounter++);

    voyages[id] = {
      id,
      from,
      to,
      length: route.name,
      multiplier: route.multiplier,
      ship: "RO-12",
      crew: { captain: null, fo: null, gc: null },
      departure: parts.slice(4).join(" ") || "TBA",
      salesOpen: false,
      cancelled: false,
      gcDeadline: null,
      cabinMap: {},
      seatMap: {}
    };

    saveData();

    return message.channel.send(
      `🚢 VOYAGE CREATED\nID: ${id}\n${from} → ${to}`
    );
  }

  /* ---------------- CLAIM ---------------- */
  if (content.startsWith("!claim")) {
    const parts = content.split(" ");
    const role = parts[1];
    const id = parts[2];

    const v = voyages[id];
    if (!v) return message.reply("❌ Voyage not found.");

    const roles = message.member?.roles.cache;

    if (!["captain", "fo", "gc"].includes(role))
      return message.reply("❌ Invalid role.");

    if (v.crew[role])
      return message.reply("❌ Already claimed.");

    if (role === "captain" && !roles.some(r => r.name === "Captain"))
      return message.reply("❌ Not Captain.");

    if (role === "fo" && !roles.some(r => r.name === "First Officer"))
      return message.reply("❌ Not FO.");

    if (role === "gc" && !roles.some(r => r.name === "Ground Crew"))
      return message.reply("❌ Not GC.");

    v.crew[role] = message.author.id;

    const crew = v.crew;

    if (crew.captain && crew.fo) {

      if (!crew.gc && !v.gcDeadline) {
        v.gcDeadline = Date.now() + 24 * 60 * 60 * 1000;

        message.channel.send(
          `⏳ Ground Crew unclaimed.\nSales open in 24h if not claimed.`
        );
      }

      if (crew.gc && v.gcDeadline) {
        delete v.gcDeadline;
      }

      if (crew.gc && !v.salesOpen) {
        v.salesOpen = true;
        message.channel.send(`🚢 SALES OPEN (Voyage ${id})`);
      }
    }

    saveData();
    return message.reply(`✅ ${role} claimed.`);
  }

  /* ---------------- BOOKING ---------------- */
  if (content.startsWith("!bookcabin") || content.startsWith("!seat")) {
    const isCabin = content.startsWith("!bookcabin");
    const target = content.split(" ")[1];

    const v = Object.values(voyages).find(x => x.salesOpen && !x.cancelled);
    if (!v) return message.reply("❌ No active voyage.");

    const price = getBasePrice(v.multiplier);

    if (isCabin) {
      if (data.cabinMap[target]) return message.reply("❌ Taken.");

      user.balance -= price;
      data.cabinMap[target] = message.author.id;
      user.cabin = target;
    } else {
      if (!isValidSeat(target) || data.seatMap[target])
        return message.reply("❌ Invalid/taken.");

      user.balance -= price;
      data.seatMap[target] = message.author.id;
      user.seat = target;
    }

    saveData();
    return message.reply(`✅ Booked ${target}`);
  }

  /* ---------------- CANCEL ---------------- */
  if (content === "!cancel") {
    let refund = 0;

    if (user.seat) {
      refund += getBasePrice() * 0.9;
      delete data.seatMap[user.seat];
      user.seat = null;
    }

    if (user.cabin) {
      refund += getBasePrice() * 0.9;
      delete data.cabinMap[user.cabin];
      user.cabin = null;
    }

    user.balance += Math.floor(refund);
    saveData();

    return message.reply(`💸 Refund: $${Math.floor(refund)}`);
  }
});

/* ---------------- AUTO ENGINE ---------------- */

setInterval(async () => {
  let changed = false;

  for (const id in voyages) {
    const v = voyages[id];
    if (!v || v.cancelled || v.salesOpen) continue;

    const crew = v.crew;
    if (!crew.captain || !crew.fo) continue;

    // Start GC timer
    if (!crew.gc && !v.gcDeadline) {
      v.gcDeadline = Date.now() + 24 * 60 * 60 * 1000;
      console.log(`⏳ GC deadline started for voyage ${id}`);
    }

    // Cancel timer if GC claimed
    if (crew.gc && v.gcDeadline) {
      delete v.gcDeadline;
    }

    // OPEN SALES ONLY WHEN TIMER EXPIRES
    if (v.gcDeadline && Date.now() >= v.gcDeadline) {
      v.salesOpen = true;
      delete v.gcDeadline;

      try {
        const channel = await client.channels.fetch(VOYAGES_CHANNEL_ID);

        await channel.send(
          `🚢 **SALES OPENED**\n` +
          `Voyage ${id}\n` +
          `${v.from} → ${v.to}\n\n` +
          `🧳 You can now book cabins and seats!`
        );
      } catch (err) {
        console.error("❌ Failed to send voyages message:", err);
      }

      console.log(`🚢 AUTO SALES OPENED: ${id}`);
      changed = true;
    }
  }

  if (changed) saveData();
}, 60 * 1000);
