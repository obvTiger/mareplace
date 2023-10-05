// Express
const Express = require("express");
const ExpressSession = require("express-session");
const ExpressCompression = require("compression");
const SessionFileStore = require("session-file-store")(ExpressSession);
const ExpressWS = require("express-ws");
// Discord
const { Client, Events, GatewayIntentBits } = require("discord.js");

// Utils
const Path = require("path");
const QueryString = require("querystring");
const promisify = require("util").promisify;

// Our stuff
const Canvas = require("./canvas");

// Configs
const Config = require("./config.json");
require("dotenv").config();



/* TODO
 * - Auto update the page like vite on any changes
 * - Sync stuff like cooldown and ban
 * - Polling system where the client polls new pixels every few seconds
 * - Log out
 * - Automatic session expiry (though ttl already does that so ???)
 * - Move more stuff to config like redirect url, etc
 */

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers] });

client.login(process.env.BOT_TOKEN);

client.once(Events.ClientReady, c => {
	console.log("Ready! Logged in as", c.user.tag);
});

/*
 * ===============================
*/

const app = Express();
const port = 1300;
ExpressWS(app);


/*
 * ===============================
*/

app.use(Express.static(Path.join(__dirname, "public")));
app.use(ExpressSession({
	store: new SessionFileStore(
		{
			path: "./canvas/sessions",
			ttl: 7 * 24 * 60 * 60,
			retries: 0,
			encoder: data => JSON.stringify(data, null, "\t")
		}),
	secret: process.env.SESSION_SECRET,
	saveUninitialized: false,
	resave: false
}));
app.use(Express.json());

async function userInfo(req, res, next) {
	if (!req.session?.user) {
		return next();
	}

	req.user = req.session.user;

	try {
		req.member = await client.guilds.cache.get(Config.guild.id).members.fetch(req.session.user.id);
	}
	catch (e) {
	}

	next();
}



/*
 * ===============================
*/

const canvas = new Canvas().initialize({ sizeX: 1000, sizeY: 1000, colors: ["#be0039", "#ff4500", "#ffa800", "#ffd635", "#00a368", "#00cc78", "#7eed56", "#00756f", "#009eaa", "#2450a4", "#3690ea", "#51e9f4", "#493ac1", "#6a5cff", "#811e9f", "#b44ac0", "#ff3881", "#ff99aa", "#6d482f", "#9c6926", "#000000", "#898d90", "#d4d7d9", "#ffffff"] });
const io = new Canvas.IO(canvas, "./canvas/current.hst").read();

// day 2 colors
// const colors = [ "#ff4500", "#ffa800", "#ffd635", "#00a368", "#7eed56", "#2450a4", "#3690ea", "#51e9f4", "#811e9f", "#b44ac0", "#ff99aa", "#9c6926", "#000000", "#898d90", "#d4d7d9", "ffffff" ];

// day 3 colors
// const colors = [ "#be0039", "#ff4500", "#ffa800", "#ffd635", "#00a368", "#00cc78", "#7eed56", "#00756f", "#009eaa", "#2450a4", "#3690ea", "#51e9f4", "#493ac1", "#6a5cff", "#811e9f", "#b44ac0", "#ff3881", "#ff99aa", "#6d482f", "#9c6926", "#000000", "#898d90", "#d4d7d9", "#ffffff", ];

// day 4 colors
// const colors = [ "#6d001a", "#be0039", "#ff4500", "#ffa800", "#ffd635", "#fff8b8", "#00a368", "#00cc78", "#7eed56", "#00756f", "#009eaa", "#00ccc0", "#2450a4", "#3690ea", "#51e9f4", "#493ac1", "#6a5cff", "#94b3ff", "#811e9f", "#b44ac0", "#e4abff", "#de107f", "#ff3881", "#ff99aa", "#6d482f", "#9c6926", "#ffb470", "#000000", "#515252", "#898d90", "#d4d7d9", "#ffffff", ];

/*
 * ===============================
*/

const oauthRedirectUrl = "https://canvas.mares.place/auth/discord/redirect"
const oauthScope = "identify";

app.get("/auth/discord", (req, res) => {
  // HTML-Seite mit Bestätigungsnachricht und Weiterleitungslink anzeigen
  const query = QueryString.encode({
      client_id: process.env.CLIENT_ID,
      scope: oauthScope,
      redirect_uri: oauthRedirectUrl,
      response_type: "code",
						});
  const confirmationPage = `
    <html>
      <body>
        <p>Welcome to Mare Place! A open source canvas developed by Mercy!

By clicking "OK," you agree that our website may collect certain data to enhance your user experience and optimize our services. The collected data includes:

User Agent: Information about your web browser and device operating system, helping us optimize our website for different devices and browsers.

IP Address: Your IP address is collected to ensure the security of our website, detect fraudulent activities, analyze general demographic data, and understand the geographical distribution of our users.

Timestamp: The time of your access to our website is logged to monitor website performance, troubleshoot errors, and analyze general user behavior.

Please note that we do not store any personally identifiable information (PII) such as names, addresses, or phone numbers. Your privacy is important to us, and we are committed to protecting all collected data in accordance with applicable data protection laws.

By agreeing to these Terms of Use, you consent to the collection and use of the aforementioned data. If you do not agree with these terms, we kindly ask you not to continue using our website.</p>
        <a href="https://discord.com/api/oauth2/authorize?${query}">Yes i agree!</a>
								 <a href="https://canvas.mares.place"> Nope i dont agree :(</a>
									<a href="https://github.com/Manechat/place.manechat.net"> Git Repository from Mercy if you want to selfhost!</a>
      </body>
    </html>
  `;

  res.send(confirmationPage);
});



app.get("/auth/discord/redirect", async (req, res) => {
	const code = req.query.code;

	if (!code) {
		return res.redirect("/");
	}

	const authRes = await fetch("https://discord.com/api/oauth2/token",
		{
			method: "POST",
			headers: { "Content-Type": "application/x-www-form-urlencoded" },
			body: new URLSearchParams(
				{
					client_id: process.env.CLIENT_ID,
					client_secret: process.env.CLIENT_SECRET,
					grant_type: "authorization_code",
					scope: oauthScope,
					redirect_uri: oauthRedirectUrl,
					code
				})
		});

	if (!authRes.ok) {
		return res.redirect("/");
	}

	const auth = await authRes.json();

	const userRes = await fetch("https://discord.com/api/users/@me",
		{
			headers: { Authorization: `${auth.token_type} ${auth.access_token}` }
		});

	if (!userRes.ok) {
		return res.redirect("/");
	}

	await promisify(req.session.regenerate.bind(req.session))(); // TODO: Clean old sessions associated with this user/id
	req.session.user = await userRes.json();

	res.redirect("/");
});



app.get("/initialize", userInfo, async (req, res) => {
	if (!req.user) {
		return res.json({ loggedIn: false, banned: false, cooldown: 0, settings: canvas.settings });
	}

	res.json({ loggedIn: true, banned: isBanned(req.member), cooldown: canvas.users.get(req.user.id).cooldown, settings: canvas.settings });
});



app.get("/canvas", ExpressCompression(), (req, res) => {
	res.contentType("application/octet-stream");
	res.send(canvas.pixels.data);
});



app.post("/place", userInfo, async (req, res) => {
	if (!req.member) {
		return res.status(401).send();
	}

	if (isBanned(req.member)) {
		return res.status(403).send();
	}

	const placed = canvas.place(+req.body.x, +req.body.y, +req.body.color, req.member.user.id);

	res.send({ placed });
});



app.post("/placer", async (req, res) => {
	if (!canvas.isInBounds(+req.body.x, +req.body.y)) {
		return res.json({ username: "" });
	}

	const pixelInfo = canvas.info[+req.body.x][+req.body.y];

	if (!pixelInfo) {
		return res.json({ username: "" });
	}

	try {
		const member = await client.guilds.cache.get(Config.guild.id).members.fetch(pixelInfo.userId.toString());

		if (member && member.nickname) {
			return res.json({ username: member.nickname });
		}
	}
	catch (e) {
	}

	const user = await client.users.fetch(pixelInfo.userId.toString());

	if (!user) {
		return res.json({ username: "" });
	}

	res.json({ username: user.username });
});



/*
 * ===============================
*/

function isBanned(member) {
	if (!member) {
		return true;
	}

	if (Config.guild.moderatorRoles.some(roleId => member.roles.cache.has(roleId))) {
		return false;
	}

	return member.communication_disabled_until || Config.guild.bannedRoles.some(roleId => member.roles.cache.has(roleId));
}



/*
 * ===============================
*/

let idCounter = 0;
const clients = new Map();

canvas.addListener("pixel", (x, y, color) => {
	console.log("Pixel sent to " + clients.size + " - " + new Date().toString());
	const buf = io.serializePixelWithoutTheOtherStuff(x, y, color);
	for (const socket of clients.values()) {
		socket.send(buf);
	}
});

app.setUpSockets = () => // TODO: THis is really ugly because of Greenlock
{

	app.ws("/", ws => {
		const clientId = idCounter++;

		clients.set(clientId, ws);

		ws.on("close", () => {
			clients.delete(clientId);
		});
	});

}
app.setUpSockets();

/*
 * ===============================
*/
app.listen(port, () => {
	console.log(`Example app listening on port ${port}`);
});


module.exports = app;