const { REST, Routes } = require("discord.js");

const rest = new REST({ version: "10" }).setToken(process.env.TOKEN);

(async () => {
  try {
    console.log("Wiping ALL commands...");

    // Remove global commands
    await rest.put(
      Routes.applicationCommands(process.env.CLIENT_ID),
      { body: [] }
    );

    // Remove guild commands
    await rest.put(
      Routes.applicationGuildCommands(
        process.env.CLIENT_ID,
        process.env.GUILD_ID
      ),
      { body: [] }
    );

    console.log("All commands wiped");
  } catch (err) {
    console.error(err);
  }
})();
