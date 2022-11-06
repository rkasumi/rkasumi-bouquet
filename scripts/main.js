Hooks.once("init", async function() {
  game.rkasumiBouquet = { dialog: [] }
})

Hooks.on("updateActor", function() {
    game.rkasumiBouquet.dialog = game.rkasumiBouquet.dialog.filter(e => e._state != -1)
    let viewers = game.rkasumiBouquet.dialog
    if (viewers.length != 0) {
        for (let viewer of viewers)
            viewer.render(true)
    }
})

Hooks.on("getSceneControlButtons", function(controls) {
  controls[0].tools.push({
    name: "bouquet",
    title: "Distribute Bouquet",
    icon: "fas fa-heart",
    visible: true,
    onClick: () => Bouquet.distribute(),
    button: true
  })
})

let bouquetSocket
Hooks.once("socketlib.ready", () => {
	bouquetSocket = socketlib.registerModule("rkasumi-bouquet")
	bouquetSocket.register("updateBouquet", Bouquet.update)
})

class Bouquet {
  static async update(tid, bouquet) {
    const actor = game.actors.get(tid)
    await actor.update({"data.bouquet": bouquet})
  }

  static distribute() {
    const activeChars = game.users.filter(u => u.active && u.character).map(u => u.character.name)
    //const activeChars = game.users.filter(u => u.character).map(u => u.character.name) // show all character
    const actors = game.data.actors.filter(c => c.type == "character" && activeChars.includes(c.name))
    let dialog = new BouquetDialog(actors)
    dialog.render(true)
  }
}

class BouquetDialog extends Dialog {
  constructor(actor, options) {
    super(options)

    this.actor = actor
    this.data = {
      title: game.i18n.localize("rkasumi-bouquet.dialog.title"),
      content: "",
      buttons: {}
    }

    game.rkasumiBouquet.dialog.push(this)
  }

	static get defaultOptions() {
    return mergeObject(super.defaultOptions, {
      template: "modules/rkasumi-bouquet/templates/bouquet-dialog.html",
      classes: ["rkasumiBouquet", "dialog"],
      width: 350
    })
  }

  /** @override */
  getData() {
    let buttons = Object.keys(this.data.buttons).reduce((obj, key) => {
      let b = this.data.buttons[key]
      if (b.condition !== false) obj[key] = b
      return obj
    }, {})

    let actors = []
    for (let a of this.actor) {
      var actor = game.actors.get(a._id)
      var bouquet = a.data.bouquet
      actors.push({id: a._id, image: actor.img, name: a.name, bouquet: bouquet})
    }

    return {
      content: this.data.content,
      buttons: buttons,
      actors: actors
    }
  }

  /** @override */
	activateListeners(html) {
    super.activateListeners(html)
    html.find('.add-bouquet').on('mousedown', this._onAddBouquet.bind(this, html))
    html.find('.use-bouquet').on('mousedown', this._onUseBouquet.bind(this, html))
    html.find('.reset-bouquet').on('contextmenu', this._onResetBouquet.bind(this, html))
  }

  async _onAddBouquet(html, event) {
    if (game.modules.get("confetti") != undefined && window.confetti) {
      const strength = window.confetti.confettiStrength.med
      const shootConfettiProps = window.confetti.getShootConfettiProps(strength)
      window.confetti.shootConfetti(shootConfettiProps)
    }

    const target = $(event.currentTarget)
    const tid = target.parent().parent()[0].dataset.id
    const actor = game.actors.get(target.parent().parent()[0].dataset.id)
    const bouquet = actor.data.data.bouquet + 1
    await bouquetSocket.executeAsGM("updateBouquet", tid, bouquet)
  }

  async _onUseBouquet(html, event) {
    const target = $(event.currentTarget)
    const tid = target.parent().parent()[0].dataset.id
    const actor = game.actors.get(tid)
    const bouquet = actor.data.data.bouquet + target.data('add')
    if (bouquet >= 0) {
      await bouquetSocket.executeAsGM("updateBouquet", tid, bouquet)
    } else {
      ChatMessage.create({
        content: game.i18n.localize("rkasumi-bouquet.errormsg"),
        user: game.user._id
      })
    }
  }

  async _onResetBouquet(html, event) {
    var target = $(event.currentTarget)
    const tid = target.parent().parent()[0].dataset.id
    await bouquetSocket.executeAsGM("updateBouquet", tid, 0)
  }
}
