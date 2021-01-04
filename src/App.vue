<template>
    <div id="app">
        <div class="overlay__game-over" v-if="gameIsOver"></div>
        <div class="game-area">
            <div class="player-health">
                {{ this.playerHealth + ' / ' + this.healthGoal }}
            </div>
            <div class="row" v-for="(rows, y) in world" :key="y">
                <div
                    class="cell"
                    :class="cellClasses(cell, x, y)"
                    v-for="(cell, x) in rows"
                    :key="x"
                >
                    {{ isPlayerCell(x, y) ? playerEmoji : '' }}
                </div>
            </div>
        </div>
    </div>
</template>

<script>
export default {
    name: 'App',
    data: () => ({
        world: new Array(12).fill(1).map(() =>
            new Array(12).fill(1).map(() => ({
                dug: 1,
                npcs: [],
            })),
        ),
        // player-state
        x: null,
        y: null,
        healthBonuses: {
            monster: 2,
            fish: 10,
        },
        npcDamage: {
            monster: 4,
            fish: 0,
        },
        playerHealth: 50,
        healthGoal: 100,
        npcs: [],
        // game-state
        turns: 0,
    }),
    beforeDestroy() {
        this.teardownKeyPresses();
    },
    beforeMount() {
        const rand = this.getRandomXY();

        this.x = rand.x;
        this.y = rand.y;
    },
    mounted() {
        this.setupKeyPresses();

        for (let i = 0; i < 3; i++) {
            this.addNpc();
        }

        window.data = this.$data;
        window.comp = this;
    },
    computed: {
        playerDead() {
            return this.playerHealth === 0;
        },
        playerEmoji() {
            if (this.playerHealth < 5) {
                return '🙀';
            } else if (this.playerHealth < 10) {
                return '🐱';
            } else if (this.playerHealth < 15) {
                return '😾';
            } else if (this.playerHealth > 100) {
                return '😺';
            }

            return '😼';
        },
        gameIsOver() {
            return this.playerHealth === 0 || this.playerHealth >= this.healthGoal;
        },
    },
    methods: {
        addNpc(type = 'monster') {
            const npc = { ...this.getRandomXY(), type };

            this.world[npc.y][npc.x].dug = true;

            this.npcs.push(npc);
            this.world[npc.y][npc.x].npcs.push(npc);
        },
        setNpcPosition(npc, newX = npc.x, newY = npc.y) {
            this.world[npc.y][npc.x].npcs = this.world[npc.y][npc.x].npcs.filter(
                (_npc) => _npc !== npc,
            );
            this.world[newY][newX].npcs.push(npc);

            npc.x = newX;
            npc.y = newY;
        },
        advanceNpcs() {
            const isNth = (nth) => this.turns % nth === 0;

            this.npcs.forEach((npc) => {
                let newX = npc.x;
                let newY = npc.y;

                if (isNth(2) && npc.type === 'monster') {
                    // aggressive
                    if (this.x < npc.x) {
                        newX--;
                    } else if (this.x > npc.x) {
                        newX++;
                    } else if (this.y < npc.y) {
                        newY--;
                    } else if (this.y > npc.y) {
                        newY++;
                    }
                } else if (isNth(8) && npc.type === 'fish') {
                    // fleeing
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

                newX = Math.min(Math.max(0, newX), this.world[0].length - 1);
                newY = Math.min(Math.max(0, newY), this.world.length - 1);

                if (this.world[newY][newX].npcs.length === 0) {
                    this.setNpcPosition(npc, newX, newY);
                }

                if (npc.x === this.x && npc.y === this.y) {
                    this.playerHealth -= this.npcDamage[npc.type];
                }
            });
        },
        advanceTurn() {
            if (this.gameIsOver) {
                return;
            }

            const isNth = (nth) => this.turns % nth === 0;

            if (isNth(1)) {
                this.playerHealth--;
            }

            this.advanceNpcs();

            if (isNth(4 + Math.floor(this.turns / 40))) {
                this.addNpc('monster');
            }

            if (isNth(Math.max(1, 3 - Math.floor(this.turns / 40)))) {
                this.addNpc('fish');
            }

            this.turns++;
        },
        teardownKeyPresses() {
            if (this.handlerFn) {
                document.removeEventListener('keydown', this.handlerFn);
                this.handlerFn = undefined;

                document.removeEventListener('swiped', this.handlerFn);
                this.swipeHandlerFn = undefined;
            }
        },
        setupKeyPresses() {
            if (!this.handlerFn) {
                this.swipeHandlerFn = (event) => {
                    if (this.gameIsOver) {
                        return;
                    }

                    switch (event.detail.dir) {
                        case 'left':
                            this.digLeft();
                            this.moveLeft();
                            this.advanceTurn();
                            break;
                        case 'right':
                            this.digRight();
                            this.moveRight();
                            this.advanceTurn();
                            break;
                        case 'up':
                            this.digUp();
                            this.moveUp();
                            this.advanceTurn();
                            break;
                        case 'down':
                            this.digDown();
                            this.moveDown();
                            this.advanceTurn();
                            break;
                    }
                };

                this.handlerFn = (event) => {
                    if (this.gameIsOver) {
                        return;
                    }

                    switch (event.key) {
                        case 'ArrowLeft':
                            this.digLeft();
                            this.moveLeft();
                            this.advanceTurn();
                            break;
                        case 'ArrowRight':
                            this.digRight();
                            this.moveRight();
                            this.advanceTurn();
                            break;
                        case 'ArrowUp':
                            this.digUp();
                            this.moveUp();
                            this.advanceTurn();
                            break;
                        case 'ArrowDown':
                            this.digDown();
                            this.moveDown();
                            this.advanceTurn();
                            break;
                    }
                };

                document.addEventListener('keydown', this.handlerFn);
                document.addEventListener('swiped', this.swipeHandlerFn);
            }
        },
        isPlayerCell(x, y) {
            return x === this.x && y === this.y;
        },
        cellClasses(cell, x, y) {
            const classes = {
                'cell--undug': cell.dug > 0,
                'cell--player': x === this.x && y === this.y,
                'cell--dead-player': x === this.x && y === this.y && this.playerDead,
            };

            const foundNpc = this.npcs.find((npc) => npc.x === x && npc.y === y);

            if (foundNpc) {
                classes['cell--npc-' + foundNpc.type] = true;

                if (foundNpc.x < this.x) {
                    classes['cell--npc-' + foundNpc.type + '-left-of-player'] = true;
                } else if (foundNpc.x > this.x) {
                    classes['cell--npc-' + foundNpc.type + '-right-of-player'] = true;
                }
            }

            return classes;
        },
        removeNpc(loc) {
            loc.npcs = loc.npcs.filter((npc) => {
                // remove all npcs from global collection
                this.npcs = this.npcs.filter((_npc) => npc !== _npc);

                if (this.healthBonuses[npc.type] !== undefined) {
                    this.playerHealth += this.healthBonuses[npc.type];
                }

                // remove npc from coordinate location
                return false;
            });
        },
        // actions
        moveUp() {
            const loc = this.world[this.y - 1]?.[this.x];

            if (loc !== undefined && loc.dug === 0) {
                this.removeNpc(loc);

                this.y--;
            }
        },
        moveDown() {
            const loc = this.world[this.y + 1]?.[this.x];

            if (loc !== undefined && loc.dug === 0) {
                this.removeNpc(loc);

                this.y++;
            }
        },
        moveLeft() {
            const loc = this.world[this.y]?.[this.x - 1];

            if (loc !== undefined && loc.dug === 0) {
                this.removeNpc(loc);

                this.x--;
            }
        },
        moveRight() {
            const loc = this.world[this.y]?.[this.x + 1];

            if (loc !== undefined && loc.dug === 0) {
                this.removeNpc(loc);

                this.x++;
            }
        },
        digUp() {
            const loc = this.world[this.y - 1]?.[this.x];

            if (loc !== undefined && loc.dug > 0) {
                loc.dug--;
            }
        },
        digDown() {
            const loc = this.world[this.y + 1]?.[this.x];

            if (loc !== undefined && loc.dug > 0) {
                loc.dug--;
            }
        },
        digLeft() {
            const loc = this.world[this.y]?.[this.x - 1];

            if (loc !== undefined && loc.dug > 0) {
                loc.dug--;
            }
        },
        digRight() {
            const loc = this.world[this.y]?.[this.x + 1];

            if (loc !== undefined && loc.dug > 0) {
                loc.dug--;
            }
        },
        // game-stuff
        getRandomXY() {
            return {
                x: Math.floor(Math.random() * 12),
                y: Math.floor(Math.random() * 12),
            };
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

.player-health {
    position: absolute;
    top: 1vh;
    width: 100%;
    height: 10vh;
    content: 'bla';
    color: white;
    font-size: 10vh;

    opacity: 0.5;
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

    font-size: 4vh;

    &--undug {
        // background: rgba(brown, 0.2);

        &:after {
            content: '';
        }
    }

    &--npc-fish {
        // background: rgba(red, 0.6);

        &:after {
            content: '🐟';
        }

        &-right-of-player {
            transform: rotateY(180deg);
        }
    }

    // &--player {
    //     // background: rgba(green, 0.6);

    //     &:after {
    //         content: '😼';
    //     }
    // }

    &--npc-monster {
        // background: rgba(yellow, 0.6);

        &:after {
            content: '👾';
        }
    }

    &--dead-player {
        // background: rgba(gray, 0.6);

        &:after {
            content: '😿';
        }
    }
}
</style>
