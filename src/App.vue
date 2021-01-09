<template>
    <div id="app">
        <div class="overlay__game-over" v-if="gameIsOver"></div>
        <div class="game-area">
            <div
                :class="{
                    'player-health-container': true,
                    'player-health-container--won': gameWon,
                    'player-health-container--lost': gameLost,
                }"
            >
                <span
                    :class="{
                        'player-health': true,
                        'player-health--positive':
                            playerHealthHistory.length > 0 &&
                            playerHealthHistory[0].modifier > 0 &&
                            playerHealthHistory[0].turn + scoreHistoryEffectTurns >= turns &&
                            !gameWon,
                        'player-health--negative':
                            playerHealthHistory.length > 0 &&
                            playerHealthHistory[0].modifier < 0 &&
                            playerHealthHistory[0].turn + scoreHistoryEffectTurns >= turns &&
                            !gameWon,
                    }"
                >
                    {{ playerHealth }}
                </span>
                <span
                    :class="{
                        'player-health-total': true,
                    }"
                >
                    {{ ' / ' + healthGoal }}
                </span>
            </div>
            <div class="row" v-for="(rows, y) in world" :key="y">
                <div
                    class="cell"
                    :class="cellClasses(cell, x, y)"
                    v-for="(cell, x) in rows"
                    :key="x"
                >
                    {{
                        (isPlayerCell(x, y) ? playerEmoji : '') +
                        (isPlayerCell(x, y) ? heldItems.map((item) => item.symbol()).join('') : '')
                    }}
                </div>
            </div>
            <div
                v-if="
                    announcementMessage !== '' &&
                    announcementTurn > turns - turnsToDisplayAnnouncements
                "
                :class="{
                    'announcement-container': true,
                }"
            >
                <p>{{ announcementMessage }}</p>
            </div>
        </div>
    </div>
</template>

<script>
import Hammer from 'hammerjs';

const itemTypes = {
    sword: (context) => ({
        attack(npc) {
            npc.health -= 2;
            this.health--;

            if (this.health === 0) {
                context.heldItems = context.heldItems.filter((item) => item !== this);

                context.announce('Your 🗡️ broke!');
            }
        },
        symbol() {
            return '🗡️';
        },
        type: 'sword',
        health: 4,
    }),
};

const npcTypes = {
    sword: (context) => ({
        damage: 0,
        healthBonus: 0,
        health: 1,
        gameLimit: 1,
        type: 'sword',
        turnCreated: context.turns,
        onDestroy: (npc) => {
            context.heldItems.unshift(itemTypes.sword(context));
            context.announce('Retrieved 🗡️. Damage is now doubled.');

            context.x = npc.x;
            context.y = npc.y;
        },
    }),
    chest: (context) => ({
        damage: 0,
        healthBonus: 0,
        health: 1,
        gameLimit: 1,
        type: 'chest',
        turnCreated: context.turns,
        shouldCreate: () =>
            context.heldItems.every((item) => item.type !== 'sword') &&
            context.npcs.every((npc) => npc.type !== 'sword'),
        onDestroy: (npc) => {
            context.addNpc('sword', { x: npc.x, y: npc.y });
        },
    }),
    fish: (context) => ({
        damage: 0,
        healthBonus: 10,
        health: 1,
        gameLimit: 10,
        type: 'fish',
        turnCreated: context.turns,
        speed: 8,
        movePattern: 'fleeing',
        onDestroy: (npc) => {
            // the player moves onto the npc, as if it ate it.
            context.x = npc.x;
            context.y = npc.y;
        },
    }),
    monster: (context) => ({
        damage: 4,
        healthBonus: 2,
        health: 2,
        type: 'monster',
        gameLimit: 15,
        turnCreated: context.turns,
        speed: 2,
        movePattern: 'hostile',
    }),
};

export default {
    name: 'App',
    data: () => ({
        world: new Array(12).fill(1).map(() =>
            new Array(12).fill(1).map(() => ({
                npcs: [],
                items: [],
            })),
        ),
        // player-state
        x: null,
        y: null,
        heldItems: [],
        playerHealth: 50,
        healthGoal: 100,
        npcs: [],
        items: [],
        // game-state
        turns: 0,
        playerHealthHistory: [],
        announcementMessage: '',
        announcementTurn: 0,
        // game-settings stuff
        initialMonsters: 3,
        playerHungerFactor: 1,
        scoreHistoryEffectTurns: 1,
        turnsToDisplayAnnouncements: 2,
    }),
    beforeDestroy() {
        this.teardownKeyPresses();
    },
    beforeMount() {
        const rand = this.getRandomXY(0, 0);

        this.x = rand.x;
        this.y = rand.y;
    },
    mounted() {
        this.setupKeyPresses();

        for (let i = 0; i < this.initialMonsters; i++) {
            this.addNpc();
        }

        this.announce(`Attack things with 😼 using Arrowkeys/Spacebar (or Swipe/Doubletap). Hit the
                    goal of ${this.healthGoal}!`);

        window.data = this.$data;
        window.comp = this;
    },
    computed: {
        gameLost() {
            return this.playerHealth === 0;
        },
        playerEmoji() {
            if (this.playerHealth === 0) {
                return '😿';
            } else if (this.playerHealth < 5) {
                return '🙀';
            } else if (this.playerHealth < 10) {
                return '🐱';
            } else if (this.playerHealth < 15) {
                return '😾';
            } else if (this.playerHealth >= 100) {
                return '😺';
            }

            return '😼';
        },
        gameIsOver() {
            return this.gameLost || this.gameWon;
        },
        gameWon() {
            return this.playerHealth >= this.healthGoal;
        },
    },
    methods: {
        announce(message) {
            this.announcementMessage = message;
            this.announcementTurn = this.turns;
        },
        setPlayerHealth(newHealth, save = true) {
            if (newHealth < 0) {
                newHealth = 0;
            }

            if (newHealth > this.healthGoal) {
                newHealth = this.healthGoal;
            }

            if (save) {
                this.playerHealthHistory.unshift({
                    modifier: newHealth - this.playerHealth,
                    turn: this.turns,
                });
            }

            this.playerHealth = newHealth;
        },
        addNpc(type = 'monster', customNpcValues = {}) {
            try {
                const npc = { ...this.getRandomXY(), ...npcTypes[type](this), ...customNpcValues };

                if (
                    (!!npc.shouldCreate && !npc.shouldCreate()) ||
                    npc.gameLimit <=
                        this.npcs.reduce((count, npc) => (npc.type === type ? count + 1 : count), 0)
                ) {
                    return;
                }

                this.npcs.push(npc);
                this.world[npc.y][npc.x].npcs.push(npc);
            } catch (e) {
                if (e.code !== 'NO_VALID_POSITION') {
                    // that's fine
                    return;
                }
                throw e;
            }
        },
        setNpcPosition(npc, newX = npc.x, newY = npc.y) {
            this.world[npc.y][npc.x].npcs = this.world[npc.y][npc.x].npcs.filter(
                (_npc) => _npc !== npc,
            );
            this.world[newY][newX].npcs.push(npc);

            npc.x = newX;
            npc.y = newY;
        },
        isNth(nth, turns = this.turns, offset = 0) {
            return turns % nth === offset;
        },
        advanceNpcs() {
            this.npcs.forEach((npc) => {
                let newX = npc.x;
                let newY = npc.y;

                if (
                    npc.movePattern !== undefined &&
                    npc.speed !== undefined &&
                    this.isNth(npc.speed, this.turns - npc.turnCreated)
                ) {
                    if (npc.movePattern === 'hostile') {
                        if (this.x < npc.x) {
                            newX--;
                        } else if (this.x > npc.x) {
                            newX++;
                        } else if (this.y < npc.y) {
                            newY--;
                        } else if (this.y > npc.y) {
                            newY++;
                        }
                    } else if (npc.movePattern === 'fleeing') {
                        if (this.x < npc.x) {
                            newX++;
                        } else if (this.x > npc.x) {
                            newX--;
                        } else if (this.y < npc.y) {
                            newY++;
                        } else if (this.y > npc.y) {
                            newY--;
                        }
                    }
                }

                newX = Math.min(Math.max(0, newX), this.world[0].length - 1);
                newY = Math.min(Math.max(0, newY), this.world.length - 1);

                if (
                    this.world[newY][newX].npcs.length === 0 &&
                    (newX !== this.x || newY !== this.y)
                ) {
                    this.setNpcPosition(npc, newX, newY);
                }

                if (newX === this.x && newY === this.y) {
                    this.setPlayerHealth(this.playerHealth - npc.damage);
                }
            });
        },
        advanceTurn() {
            if (this.gameIsOver) {
                return;
            }

            if (this.isNth(1)) {
                // hunger
                this.setPlayerHealth(this.playerHealth - this.playerHungerFactor, false);
            }

            this.advanceNpcs();

            if (this.isNth(5 + Math.floor(this.turns / 40))) {
                this.addNpc('monster');
            }

            if (this.isNth(Math.max(1, 3 - Math.floor(this.turns / 40)))) {
                this.addNpc('fish');
            }

            if (this.isNth(Math.floor(Math.random() * 3) === 0)) {
                this.addNpc('chest');
            }

            this.turns++;
        },
        teardownKeyPresses() {
            if (this.handlerFn) {
                document.removeEventListener('keydown', this.handlerFn);

                this.mc.destroy();
            }
        },
        setupKeyPresses() {
            if (!this.handlerFn) {
                this.handlerFn = (event) => {
                    if (this.gameIsOver) {
                        return;
                    }

                    switch (event.key) {
                        case 'ArrowLeft':
                            this.moveOrAttack('left');
                            this.advanceTurn();
                            break;
                        case 'ArrowRight':
                            this.moveOrAttack('right');
                            this.advanceTurn();
                            break;
                        case 'ArrowUp':
                            this.moveOrAttack('up');
                            this.advanceTurn();
                            break;
                        case 'ArrowDown':
                            this.moveOrAttack('down');
                            this.advanceTurn();
                            break;
                        case ' ':
                            this.advanceTurn();
                            break;
                    }
                };

                this.mc = new Hammer(this.$el);
                this.mc.get('swipe').set({ direction: Hammer.DIRECTION_ALL });

                this.mc.on('swipeleft', () => {
                    this.handlerFn({ key: 'ArrowLeft' });
                });

                this.mc.on('swiperight', () => {
                    this.handlerFn({ key: 'ArrowRight' });
                });

                this.mc.on('swipeup', () => {
                    this.handlerFn({ key: 'ArrowUp' });
                });

                this.mc.on('swipedown', () => {
                    this.handlerFn({ key: 'ArrowDown' });
                });

                this.mc.on('doubletap', () => {
                    this.handlerFn({ key: ' ' });
                });

                document.addEventListener('keydown', this.handlerFn);
            }
        },
        isPlayerCell(x, y) {
            return x === this.x && y === this.y;
        },
        cellClasses(cell, x, y) {
            const classes = {
                'cell--player': x === this.x && y === this.y,
                'cell--dead-player': x === this.x && y === this.y && this.gameLost,
            };

            const foundNpc = this.npcs.find((npc) => npc.x === x && npc.y === y);

            if (foundNpc) {
                classes['cell__npc-' + foundNpc.type] = true;

                if (this.isNth(foundNpc.speed, this.turns - foundNpc.turnCreated)) {
                    classes['cell__npc-' + foundNpc.type + '--moving'] = true;
                }

                if (foundNpc.x < this.x) {
                    classes['cell__npc-' + foundNpc.type + '--left-of-player'] = true;
                } else if (foundNpc.x > this.x) {
                    classes['cell__npc-' + foundNpc.type + '--right-of-player'] = true;
                }
            }

            return classes;
        },
        attackNpc(loc) {
            loc.npcs = loc.npcs.filter((npc) => {
                if (npc.healthBonus !== undefined) {
                    this.setPlayerHealth(this.playerHealth + npc.healthBonus);
                }

                // remove npc from coordinate location
                const attackItem = this.heldItems.find((item) => item.attack);

                if (attackItem) {
                    attackItem.attack(npc);
                } else {
                    // fist-fighting monsters, yeah!
                    npc.health -= 1;
                }

                if (npc.health <= 0) {
                    if (npc.onDestroy) {
                        npc.onDestroy(npc);
                    }

                    // remove all npcs from global collection
                    this.npcs = this.npcs.filter((_npc) => npc !== _npc);
                    return false;
                }
                return true;
            });
        },
        // actions
        moveOrAttack(direction) {
            let newX = this.x;
            let newY = this.y;

            switch (direction) {
                case 'up':
                    newY--;
                    break;
                case 'down':
                    newY++;
                    break;
                case 'left':
                    newX--;
                    break;
                case 'right':
                    newX++;
                    break;
            }

            const loc = this.world[newY]?.[newX];

            if (loc !== undefined) {
                if (loc.npcs.length === 0) {
                    this.x = newX;
                    this.y = newY;
                } else {
                    this.attackNpc(loc);
                }
            }
        },
        // game-stuff
        getRandomXY(requiredDistanceFromPlayer = 2, requiredDistanceFromNpcs = 3) {
            const randomize = () => ({
                x: Math.floor(Math.random() * 12),
                y: Math.floor(Math.random() * 12),
            });

            const isWithinPlayerDistance = (x, y) =>
                (x <= this.x - requiredDistanceFromPlayer ||
                    x >= this.x + requiredDistanceFromPlayer) &&
                (y <= this.y - requiredDistanceFromPlayer ||
                    y >= this.y + requiredDistanceFromPlayer);

            const isWithinNpcsDistance = (x, y) =>
                this.npcs.every(
                    (npc) =>
                        (x <= npc.x - requiredDistanceFromNpcs ||
                            x >= npc.x + requiredDistanceFromNpcs) &&
                        (y <= npc.y - requiredDistanceFromNpcs ||
                            y >= npc.y + requiredDistanceFromNpcs),
                );

            const maxAttempts = 50;
            let attempts = 0;
            let retries = 0;

            let result;
            do {
                result = randomize();
                attempts++;

                if (attempts === maxAttempts && requiredDistanceFromNpcs > 1) {
                    requiredDistanceFromNpcs--;
                    retries++;
                    attempts = 0;
                }

                if (attempts === maxAttempts && requiredDistanceFromPlayer > 1) {
                    requiredDistanceFromPlayer--;
                    retries++;
                    attempts = 0;
                }

                if (
                    (requiredDistanceFromPlayer > 0 &&
                        !isWithinPlayerDistance(result.x, result.y)) ||
                    (requiredDistanceFromNpcs > 0 && !isWithinNpcsDistance(result.x, result.y))
                ) {
                    result = null;
                }
            } while (!result && attempts < maxAttempts);

            if (result) {
                return result;
            }

            // this is basically super rare.
            const e = new Error(
                'Failed to generate a suitable position after ' +
                    attempts * (retries + 1) +
                    ' attempts (with ' +
                    retries +
                    ' retries, lowering required distances from other things)',
            );
            e.code = 'NO_VALID_POSITION';
            throw e;
        },
    },
    components: {},
};
</script>

<style lang="scss">
@import url(https://fonts.googleapis.com/css?family=Exo:100);

/* Background data (Original source: https://subtlepatterns.com/grid-me/) */
$bg-url: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADIAAAAyCAIAAACRXR/mAAAACXBIWXMAAAsTAAALEwEAmpwYAAAAIGNIUk0AAHolAACAgwAA+f8AAIDpAAB1MAAA6mAAADqYAAAXb5JfxUYAAABnSURBVHja7M5RDYAwDEXRDgmvEocnlrQS2SwUFST9uEfBGWs9c97nbGtDcquqiKhOImLs/UpuzVzWEi1atGjRokWLFi1atGjRokWLFi1atGjRokWLFi1af7Ukz8xWp8z8AAAA//8DAJ4LoEAAlL1nAAAAAElFTkSuQmCC';
$bg-width: 50px;
$bg-height: 50px;

/* Animations */
@-webkit-keyframes bg-scrolling-reverse {
    100% {
        background-position: $bg-width $bg-height;
    }
}
@-moz-keyframes bg-scrolling-reverse {
    100% {
        background-position: $bg-width $bg-height;
    }
}
@-o-keyframes bg-scrolling-reverse {
    100% {
        background-position: $bg-width $bg-height;
    }
}
@keyframes bg-scrolling-reverse {
    100% {
        background-position: $bg-width $bg-height;
    }
}

@-webkit-keyframes bg-scrolling {
    0% {
        background-position: $bg-width $bg-height;
    }
}
@-moz-keyframes bg-scrolling {
    0% {
        background-position: $bg-width $bg-height;
    }
}
@-o-keyframes bg-scrolling {
    0% {
        background-position: $bg-width $bg-height;
    }
}
@keyframes bg-scrolling {
    0% {
        background-position: $bg-width $bg-height;
    }
}

/* Main styles */
.game-area {
    z-index: 1;
    overflow: hidden;
}

.overlay__game-over {
    position: absolute;
    height: 100%;
    width: 100%;

    filter: invert(1);

    background: rgba(black, 0.93);
    color: #999;
    font: 400 16px/1.5 exo, ubuntu, 'segoe ui', helvetica, arial, sans-serif;
    text-align: center;
    /* img size is 50x50 */
    background: url($bg-url) repeat 0 0;

    -webkit-animation: bg-scrolling-reverse 0.92s infinite; /* Safari 4+ */
    -moz-animation: bg-scrolling-reverse 0.92s infinite; /* Fx 5+ */
    -o-animation: bg-scrolling-reverse 0.92s infinite; /* Opera 12+ */
    animation: bg-scrolling-reverse 0.92s infinite; /* IE 10+ */
    -webkit-animation-timing-function: linear;
    -moz-animation-timing-function: linear;
    -o-animation-timing-function: linear;
    animation-timing-function: linear;

    &::before {
        font-size: 8rem;
        font-weight: 100;
        font-style: normal;
    }
}

html,
body {
    padding: 0;
    margin: 0;
    height: 100%;

    overscroll-behavior: contain;
}

#app {
    font-family: Avenir, Helvetica, Arial, sans-serif;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
    text-align: center;

    background: rgba(black, 0.93);

    height: 100%;

    display: flex;
    flex-direction: column;
    justify-content: space-around;
}

.announcement-container {
    position: absolute;
    bottom: 1vh;
    width: 100%;
    color: white;
    font-size: 2vh;

    opacity: 0.5;
}

.player-health-container {
    position: absolute;
    top: 1vh;
    width: 100%;
    height: 10vh;
    color: white;
    font-size: 10vh;

    opacity: 0.5;

    &--won {
        color: rgba(gold, 1);
    }

    &--lost {
        color: rgba(gray, 0.6);
    }
}

.player-health {
    &--positive {
        color: rgba(green, 1);
        opacity: 0.7;
    }

    &--negative {
        color: rgba(red, 1);
        opacity: 0.7;
    }
}

.row {
    display: flex;
    justify-content: space-around;
}

.cell {
    width: 5vw;
    height: 5vh;
    margin-bottom: 12px;

    display: flex;
    align-items: center;
    justify-content: center;

    border: 2px solid rgba(50, 50, 50, 1);
    padding: 5px;

    font-size: 2vh;

    &__npc-fish {
        &:after {
            content: '🐟';
        }

        &--right-of-player {
            transform: rotateY(180deg);
        }
    }

    &__npc-monster {
        &:after {
            content: '👾';
        }

        &--moving {
            filter: hue-rotate(65deg);
        }
    }

    &__npc-sword {
        &:after {
            content: '🗡️';
        }
    }

    &__npc-chest {
        &:after {
            content: '🎁';
        }
    }
}
</style>
