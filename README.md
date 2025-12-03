## BOMB

### Description

This is an online game for two or more players. There are no logins, so to start
gameplay a user simply needs to provide a name to create a game or join an
existing one (game join requests are sent to the creator and must be approved).
Games cannot be joined once in progress.

### Gameplay

The first player begins play by selecting a movie using the search bar. Once
they've made a selection, player 2 must name an actor who appeared in that
movie. The next player (either player 3 or the first player if there are only
two players) must then name a movie starring that actor.

If a player clicks the "Challenge" button, the previous player must make a
selection. If their selection is valid (meaning movie and actor match), the
challenging player receives a letter. If the selection is invalid or they give
up, the challenged player receives a letter. The letters are B, O, M, and B, in
that order. Players can also mark previous responses as invalid, at which time
the player who provided the incorrect response immediately receives a letter.

A new round begins whenever a player gets a letter. All rounds of gameplay are
displayed on the screen. Actors and movies cannot be reused at any time. Players
are eliminated once they've spelled out BOMB. The final player who was not
eliminated is the winner.

### Technical Overview

This is a simple express server with a frontend written in TypeScript, HTML, and
CSS. It uses web sockets to keep track of the game state. There's no database.

### Development

To start the dev server with hot reloading, run:

```bash
npm run dev
```

To create and start a local build (no hot reloading), run:

```bash
npm run prod
```

You'll need to manually stop and restart the server if you make changes.

### Formatting

To lint the code and automatically format it, run:

```bash
npm run lint
```

### Deployment

To deploy on Fly.io using the Dockerfile, run:

```bash
flyctl deploy
```

You'll also need to set the secret key used for JWT encryption/decryption:

```bash
fly secrets set JWT_SECRET=your_secret_here
```
