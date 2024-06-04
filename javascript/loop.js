import { Result, canvas, ctx, getId, hoverPos, scrX, scrY, tileSize } from "./globals/core.js";
import { Position, Solidity, hoveredCreature, hoveredItem, hoveredTile, renderedPosition, toScreen } from "./map.js";
export let tick = 0;
function drawSelector(p) {
    let x = Math.round(0.5 * canvas.width - scrX + p.x * tileSize - renderedPosition.x);
    let y = Math.round(0.5 * canvas.height - scrY + p.y * tileSize - renderedPosition.y);
    let s = tick % tileSize, t = tileSize - s;
    let slot = 5, w = 1;
    ctx.fillRect(x, y, s, w);
    ctx.fillRect(x + s + slot, y, Math.max(0, t - slot), w);
    ctx.fillRect(x, y, w, t);
    ctx.fillRect(x, y + t + slot, w, Math.max(0, s - slot));
    ctx.fillRect(x, y + tileSize, t, w);
    ctx.fillRect(x + t + slot, y + tileSize, Math.max(0, s - slot), w);
    ctx.fillRect(x + tileSize, y, w, s);
    ctx.fillRect(x + tileSize, y + s + slot, w, Math.max(0, t - slot));
}
export function loop(player) {
    try {
        tick++;
        // render the map
        player.renderHere();
        // tooltips (for debug purposes)
        let ht = hoveredTile(), hc = hoveredCreature(), hi = hoveredItem();
        if (hc)
            getId("floater").textContent = `${hc.name} (HP: ${hc.hp.cur}/${hc.hp.max}, jump: ${hc.jumpLeft}/${hc.getJump()}, speed: ${hc.speedLeft}/${hc.getSpeed()}${hc.inventory.length ? ", inventory " + hc.inventory.map(x => x.item ? x.item.name : "{empty}").join(", ") : ""})`;
        else if (hi)
            getId("floater").textContent = hi.name;
        else if (ht)
            getId("floater").textContent = Solidity[ht.solidity] + " tile";
        else
            getId("floater").textContent = "";
        getId("floater").textContent += " - " + new Position(hoverPos().x, hoverPos().y, player.pos.region);
        ctx.fillStyle = "salmon";
        for (let d of [[-1, -1], [-1, 0], [-1, 1], [0, -1], [1, -1], [1, 0], [1, 1], [0, 1]]) {
            let x = player.pos.x + d[0];
            let y = player.pos.y + d[1];
            if (player.tryStep(x, y) == Result.ok)
                drawSelector(new Position(x, y, player.pos.region));
        }
        // draw the selector tool
        if (ht) {
            ctx.fillStyle = player.pos.canSee(ht.pos) ? "white" : "red";
            ctx.strokeStyle = player.pos.canSee(ht.pos) ? "white" : "red";
            drawSelector(ht.pos);
            ctx.beginPath();
            ctx.moveTo(toScreen(player.pos.center).x, toScreen(player.pos.center).y);
            ctx.lineTo(toScreen(ht.pos.center).x, toScreen(ht.pos.center).y);
            ctx.stroke();
        }
    }
    catch (e) {
        alert("ERROR::LOOP::'" + e + "'");
    }
}
export function loopStart(player) {
    document.onkeydown = function (ev) {
        try {
            if (ev.key == "d") {
                player.step(player.pos.x + 1, player.pos.y);
            }
            else if (ev.key == "a") {
                player.step(player.pos.x - 1, player.pos.y);
            }
            else if (ev.key == "w") {
                player.step(player.pos.x, player.pos.y - 1);
            }
            else if (ev.key == "q") {
                player.step(player.pos.x - 1, player.pos.y - 1);
            }
            else if (ev.key == "e") {
                player.step(player.pos.x + 1, player.pos.y - 1);
            }
            else if (ev.key == "z") {
                player.step(player.pos.x - 1, player.pos.y + 1);
            }
            else if (ev.key == "c") {
                player.step(player.pos.x + 1, player.pos.y + 1);
            }
            else if (ev.key == "s") {
                if (player.flying) {
                    player.step(player.pos.x, player.pos.y + 1);
                }
                else {
                    player.fall();
                }
            }
            else if (ev.key == " ") {
                let i = player.pos.region.itemAt(player.pos.x, player.pos.y);
                if (i)
                    player.pickup(i);
            }
            else if (ev.key == "t") {
                // TODO: make a proper UI for throwing. in the meantime just throw the first item if there is one
                player.throw(player.inventory[0], hoveredTile().pos); // hope this works
            }
            else if (ev.key == "p") {
                player.team.end();
            }
        }
        catch (e) {
            alert("ERROR::KEY::'" + ev.key + "';'" + e + "'");
        }
    };
    document.addEventListener("onclick", function (ev) {
        try {
            // TODO //
        }
        catch (e) {
            alert("ERROR::CLICK::'" + e + "'");
        }
    });
    setInterval(loop, 20, player);
}
