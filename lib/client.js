// dsh-router-flash client bundle（标准双面占位）。
// 本 bundle 只负责在宿主端安装 agent preset，无浏览器 UI，
// 此模块保持空实现以符合 DSH bundle 的标准双面结构。
window.__ModuleLoader__.load({
  id: "dsh-router-flash",
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
    Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
    function apply() {}
    exports.apply = apply;
    return module.exports;
  }
});
