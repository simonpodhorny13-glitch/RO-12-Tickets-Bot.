const fs = require("fs");

module.exports = {
  name: "claim",

  execute(message, args) {
    const role = args[0];
    const voyageId = args[1];

    if (!role || !voyageId) {
      return message.reply("❌ Usage: !claim <captain|fo|gc> <voyageId>");
    }

    const data = JSON.parse(fs.readFileSync("./data.json", "utf8"));

    const voyage = data.voyages[voyageId];

    if (!voyage) {
      return message.reply("❌ Voyage not found.");
    }

    if (!voyage.crew) {
      voyage.crew = {
        captain: null,
        fo: null,
        gc: null
      };
    }

    const userId = message.author.id;

    if (!["captain", "fo", "gc"].includes(role)) {
      return message.reply("❌ Role must be captain, fo, or gc.");
    }

    if (voyage.crew[role]) {
      return message.reply(`❌ ${role.toUpperCase()} already claimed.`);
    }

    // assign role
    voyage.crew[role] = userId;

    const crew = voyage.crew;

    // =========================
    // 🚢 CORE LOGIC
    // =========================

    if (crew.captain && crew.fo) {

      // warn if GC missing
      if (!crew.gc) {
        message.channel.send(
`⏳ Ground Crew role unclaimed.
Sales will begin within 24 hours if role is not claimed.`
        );
      }

      // open sales if not already open
      if (!voyage.salesOpen) {
        voyage.salesOpen = true;

        message.channel.send(
`🚢 SALES NOW OPEN

Voyage ID
${voyageId}

From
${voyage.from}

To
${voyage.to}

Ship
${voyage.ship}

Departing
${voyage.date}, ${voyage.time}

Route Type
${voyage.length === 1 ? "Short" : voyage.length === 2 ? "Medium" : "Long"}`
        );
      }
    }

    fs.writeFileSync("./data.json", JSON.stringify(data, null, 2));

    message.reply(`✅ ${role.toUpperCase()} claimed for voyage ${voyageId}.`);
  }
};
