/**
 * This is a testing framework that enables us to test the user idle detection
 * by intercepting the connection between the renderer and the browser and
 * exposing a mocking API for tests.
 *
 * Usage:
 *
 * 1) Include <script src="mock.js"></script> in your file.
 * 2) Set expectations
 *   expect(addMonitor).andReturn((threshold, monitorPtr, callback) => {
 *     // mock behavior
 *   })
 * 3) Call navigator.idle.query()
 *
 * The mocking API is blink agnostic and is designed such that other engines
 * could implement it too. Here are the symbols that are exposed to tests:
 *
 * - function addMonitor(): the main/only function that can be mocked.
 * - function expect(): the main/only function that enables us to mock it.
 * - function close(): disconnects the interceptor.
 * - enum IdleState {IDLE, ACTIVE, LOCKED}: blink agnostic constants.
 */

var service = (async function() {
  let load = Promise.resolve();
  [
    '/gen/mojo/public/js/mojo_bindings.js',
    '/gen/mojo/public/mojom/base/string16.mojom.js',
    '/gen/mojo/public/mojom/base/time.mojom.js',
    '/gen/third_party/blink/public/platform/modules/idle/idle_manager.mojom.js'
  ].forEach(path => {
    let script = document.createElement('script');
    script.src = path;
    script.async = false;
    load = load.then(() => new Promise(resolve => {
      script.onload = resolve;
    }));
    document.head.appendChild(script);
  });

  return load.then(intercept);
})();

function intercept() {
  let result = new FakeIdleMonitor();

  let binding = new mojo.Binding(blink.mojom.IdleManager, result);
  let interceptor = new MojoInterfaceInterceptor(blink.mojom.IdleManager.name);
  interceptor.oninterfacerequest = (e) => {
    binding.bind(e.handle);
  }

  interceptor.start();

  UserIdleState.ACTIVE = blink.mojom.UserIdleState.kActive;
  UserIdleState.IDLE = blink.mojom.UserIdleState.kIdle;
  ScreenIdleState.LOCKED = blink.mojom.ScreenIdleState.kLocked;
  ScreenIdleState.UNLOCKED = blink.mojom.ScreenIdleState.kUnlocked;

  result.setBinding(binding);
  return result;
}

class FakeIdleMonitor {
  addMonitor(threshold, monitorPtr, callback) {
    return this.handler.addMonitor(threshold, monitorPtr);
  }
  setHandler(handler) {
    this.handler = handler;
    return this;
  }
  setBinding(binding) {
    this.binding = binding;
    return this;
  }
  close() {
    this.binding.close();
  }
}

const UserIdleState = {};
const ScreenIdleState = {};

function addMonitor(threshold, monitorPtr, callback) {
  throw new Error("expected to be overriden by tests");
}

async function close() {
  let interceptor = await service;
  interceptor.close();
}

function expect(call) {
  return {
    async andReturn(callback) {
      let interceptor = await service;
      let handler = {};
      handler[call.name] = callback;
      interceptor.setHandler(handler);
    }
  }
}