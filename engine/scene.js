// Override what you need; defaults are no-ops so you can ignore the rest.
export class Scene {
  enter(ctx) {}
  exit() {}
  update(dt) {}
  render(ctx) {}
  pointerDown(e) {}
  pointerMove(e) {}
  pointerUp(e) {}
  keyDown(code) {}
  keyUp(code) {}
}

export class SceneStack {
  constructor() {
    this.stack = [];
  }

  push(scene, ctx) {
    this.stack.push(scene);
    if (scene.enter) scene.enter(ctx);
    return scene;
  }

  pop() {
    const scene = this.stack.pop();
    if (scene && scene.exit) scene.exit();
    return scene;
  }

  replace(scene, ctx) {
    while (this.stack.length) this.pop();
    return this.push(scene, ctx);
  }

  current() {
    return this.stack[this.stack.length - 1];
  }

  update(dt) {
    const top = this.current();
    if (top && top.update) top.update(dt);
  }

  render(ctx) {
    for (const scene of this.stack) {
      if (scene.render) scene.render(ctx);
    }
  }

  dispatch(method, ...args) {
    const top = this.current();
    if (top && top[method]) top[method](...args);
  }
}
