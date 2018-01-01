# bower-away [![Modern Node](https://img.shields.io/badge/modern-node-9BB48F.svg)](https://github.com/sheerun/modern-node)

Convert your project from [Bower](https://bower.io/) to [Yarn](https://yarnpkg.com). Read about how it works at [Bower blog](https://bower.io/blog/2017/how-to-migrate-away-from-bower/).

## Usage

```sh
yarn global add bower-away # or "npm install -g bower-away"
bower-away # listen and repeat!
```

## Edge cases

If your Bower project depended on single resource as follows:

```
"dependencies": {
  "analytics": "https://www.google-analytics.com/analytics.js"
}
```

It is recommended that you download this file directly into your project, so it doesn't change across time.

## License

MIT
