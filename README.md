# Enum Stripper Vite Plugin

This is a sketchy [Vite](https://vite.dev/) plugin that will strip Typescript enums from the minified build output, and replace all references with the underlying constant value.

## Example

Take this source code

```ts
const enum MyEnum {
    NumberEnumItem = 123,
    StringEnumItem = 'ABC'
}

const dogs: MyEnum = Math.random() > 0.5 ? MyEnum.NumberEnumItem : MyEnum.StringEnumItem;

if (dogs === MyEnum.NumberEnumItem) {
    // do something
} else if (dogs === MyEnum.StringEnumItem) {
    // do something
} else {
    // impossible fun
}
```

Build it with Vite. You get this for the enum definition (names `n` and `t` are assigned by Vite, can differ every build)

```js
var n=(t=>(t[t.NumberEnumItem=123]="NumberEnumItem",t.StringEnumItem="ABC",t))(n||{})
```

and this for the code referencing the enum (whitespace re-added for readibility)

```js
const c = Math.random() > .5 ? n.NumberEnumItem : n.StringEnumItem;
c === n.NumberEnumItem ? doSomethingCode1 : c === n.StringEnumItem ? doSomethingCode2 : doSomethingImpossible;
```

After adding this plugin, the build code has no enum definition and the code (with re-added whitespace) looks like

```js
const c = Math.random() > .5 ? 123 : "ABC";
c === 123 ? doSomethingCode1 : c === "ABC" ? doSomethingCode2 : doSomethingImpossible;
```

### Try It

1. Clone this repo.
2. Have NodeJS installed.
3. Run `npm ci`
4. Run `npm run build`
5. Visit folder `clone-folder/build/assets` and see the output of the above example.

## Setup

1. Put a copy of `vite.enum.plugin.ts` into your project.
2. In your `vite.config.ts` file, import the plugin from that file.
3. Add the plugin to your vite config's plugins array.

```ts
// vite.config.ts

import { defineConfig } from 'vite';
import { enumStripperPlugin } from 'path-to/vite.enum.plugin';

export default defineConfig({
    build: {
       yourSettings: 'stuff'
    },
    plugins: [enumStripperPlugin()],
    moreSettings: {}
});
```

The plugin will only apply to the minified proper build. Dev builds & hot reload type stuff will be unaffected.

Two other files will appear in `build/assets` folder:
- `<package-name>.orig.js`, which is the original, unaltered build output
- `<package-name>.elog.txt`, which lists all the enums that were identified and stripped

These exist for troubleshooting purposes. Their creation can be disabled by commenting out some lines in the plugin. Search for variables `outfileBackup` and `outfileLog`.

While it would be easier to use if the plugin was published on `npm`, it's not very robust so didn't feel appropriate.

## Testing

Works on my machine :trophy:

I've been running Node `v22.12.0` and Vite `v6.0.1`

## Careful Now

> [!NOTE]
> This currently only targets a single build output file at `build/assets/<package-name>.js`. Supporting split/chunked builds would require more code magic.

> [!WARNING]
> If using this plugin on a project of any real importance (as in, a bug could cause real harm or loss), I'd suggest you reconsider. If you really want your enums banished, be sure to test the living daylights out of the built product.

> [!WARNING]
> The plugin operates on bulk string replacements. If your enum item names are the same as object property names, it is possible that Vite's minified variable names get an unlucky lineup of letters and results in the wrong thing being replaced. E.g. minified enum `v.loaded` (underlying value `"L"`) and minified object property reference `dv.loaded` would result in a catastrophic replacement of `d"L"`. This can be mitigated by having a distinct naming convention (e.g. all-caps enums) or choosing unique enum names (the extra verbosity will get stripped from the build). Unique names can also help avoid any fluke matches that might sneak in from third-party package internals.

> [!CAUTION]
> Do not use this if...
> - You are building a library that has enums as part of the public interface (you probably shouldn't be doing this regardless)
> - Your code is actively using the enum data structure (e.g. reverse mapping a value to the enum item name)

## Why

I love using enums in Typescript. With one simple definition, I get a type, a set of values with nice named aliases, a single source of the underlying constant, and autocomplete goodness.

BUT...

- Enums in Typescript are bad. Evil, perhaps. Search the topic, you'll get an earful. 
- Enums add some bloat to the build output, as it has a fancy defining method and references the names rather than the values.

And I usually don't like the suggested alternatives.

- Union of constants: the constant value is repeated everywhere it's used (no one-spot to change it); no JSDoc on the definition; no aliasing with a longer name without making more types
- An `as const` object: typically need to separate the type and the object of values; can sneak in raw values and the type is satisfied; verbose object keys embedded in final build

(Caveat: maybe there is a better way, I've yet to come across it)

This plugin solves things for me. I get the simplicity and elegance of the enum while developing, but my final build has all the shenanigans wiped from it. Just raw, succinct constants where they are needed.

In my [Solforge](https://github.com/grousewood-games/solforge) card game project, this plugin currently shaves about 88k off the minified js bundle.

