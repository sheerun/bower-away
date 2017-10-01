#!/usr/bin/env node

const updateNotifier = require('update-notifier')
const meow = require('meow')
const bowerConfig = require('bower-config')
const which = require('which')
const chalk = require('chalk')
const path = require('path')
const fs = require('fs')
const { startsWith } = require('lodash')
const execa = require('execa')
const cloneDeep = require('clone-deep')
const difflet = require('difflet')({ indent: 2 })
const deepIs = require('deep-is')

const pkg = require('./package.json')
updateNotifier({ pkg }).notify()

const cli = meow(
  `
  Usage
    $ bower-away

  Please call this command for next step to convert your project to Yarn
  `
)

function help () {
  console.error(cli.help)
  process.exit(1)
}

function step (title, lines, last = false) {
  console.error()
  console.error(chalk.green('# ' + title))

  console.error()
  console.error(lines.join('\n'))

  if (!last) {
    console.error()
    console.error(
      chalk.red("Please call bower-away once more when you're done with this!")
    )
  }

  console.error()

  process.exit(0)
}

function exists (bin) {
  var path

  try {
    path = which.sync(bin)
  } catch (e) {
    return false
  }

  return path
}

async function main () {
  const cwd = process.cwd()

  if (!fs.existsSync(path.join(cwd, 'bower.json'))) {
    if (fs.existsSync(path.join(cwd, 'node_modules', '@bower_components'))) {
      step(
        'Done',
        ['Your project is now converted to Yarn! Thank you for using Bower!'],
        true
      )
    } else {
      step('Browse to project directory', [
        'Current directory does not contain bower.json',
        '',
        'Please browse to directory that contains your project to convert.'
      ])
    }
  }

  const yarnPath = exists('yarn', cwd)

  if (!yarnPath) {
    step('Install Yarn', [
      'A good first step to migrate to Yarn is installing it!',
      '',
      'Please choose your preferred method:',
      'https://yarnpkg.com/lang/en/docs/install/',
      '',
      'One good way to install it is:',
      '$ npm install -g yarn',
      '',
      "At the end you should be able to confirm Yarn's version with:",
      '$ yarn --version',
      '',
      'THE MINIMUM SUPPORTED VERSION OF YARN IS 1.0.0!'
    ])
  }

  const bowerPath = exists('bower')

  if (!bowerPath) {
    step('Install Bower', [
      'We cannot drop Bower just yet, we need it to install legacy dependencies.',
      '',
      'As a first step, please install Bower with:',
      '$ npm install -g bower',
      '',
      '...or if your project requires specific version of Bower:',
      '$ npm install -g bower@1.4.x',
      '',
      "At the end you should be able to confirm Bower's version with:",
      '$ bower --version'
    ])
  }

  const config = bowerConfig.read(cwd)
  const componentsDir = path.resolve(cwd, config.directory)

  if (
    !fs.existsSync(componentsDir) &&
    !fs.existsSync(path.join(cwd, 'node_modules', '@bower_components'))
  ) {
    step('Install dependencies with Bower', [
      'We need to install dependencies the old way first. Please run:',
      '$ bower install',
      '',
      'At the end you should see some packages in:',
      componentsDir
    ])
  }

  let original = {}

  if (fs.existsSync('package.json')) {
    original = JSON.parse(fs.readFileSync('package.json'))
  }

  const expected = cloneDeep(original)

  if (expected.dependencies) {
    Object.keys(expected.dependencies).forEach(function (k) {
      if (k.indexOf('@bower_components') >= 0) {
        delete expected.dependencies[k]
      }
    })
  }

  const pkgs = fs.readdirSync(componentsDir)

  for (const pkg of pkgs) {
    const manifest = JSON.parse(
      fs.readFileSync(path.join(componentsDir, pkg, '.bower.json'))
    )

    let source = manifest._source
    let target = manifest._target

    if (source.slice(0, 19) === 'https://github.com/') {
      source = source.slice(19)

      if (source.slice(-4) === '.git') {
        source = source.slice(0, -4)
      }

      source = source
    }

    if (!('dependencies' in expected)) {
      expected.dependencies = {}
    }

    expected.dependencies[`@bower_components/${pkg}`] = `${source}#${target}`
  }

  if (typeof expected.engines !== 'object') {
    expected.engines = {}
  }

  if (!expected.engines.yarn) {
    expected.engines.yarn = '>= 1.0.0'
  }

  if (!deepIs(expected, original)) {
    if (cli.flags.diff) {
      if (process.stdout.isTTY) {
        console.log(difflet.compare(original, expected, { indent: 2 }))
      }

      process.exit(0)
    } else if (cli.flags.apply) {
      fs.writeFileSync('package.json', JSON.stringify(expected, null, 2) + '\n')
    } else {
      if (fs.existsSync('package.json')) {
        step('Update package.json', [
          'Changes need to be made in package.json. Please run following to preview them:',
          '',
          '$ bower-away --diff',
          '',
          'And then apply them by running:',
          '',
          '$ bower-away --apply'
        ])
      }
    }
  }

  if (!fs.existsSync(path.join(cwd, 'node_modules', '@bower_components'))) {
    step('Install dependencies with Yarn', [
      'Now what package.json contains Bower dependencies, please install them with:',
      '$ yarn',
      '',
      'If you encounter issues during installation, please try:',
      '$ yarn --ignore-engines --ignore-scripts',
      '',
      'You can use this command from now on to install both npm and bower dependencies.'
    ])
  }

  const source = path.relative(process.cwd(), componentsDir)
  const target = path.relative(
    path.dirname(componentsDir),
    'node_modules/@bower_components'
  )
  const script = 'rm -rf ' + source + ' && ln -sf ' + target + ' ' + source

  if (fs.existsSync(path.join(cwd, 'bower.json'))) {
    step('Remove bower.json and old bower components directory', [
      'Your project is now converted to Yarn!',
      '',
      'You should find all bower components in node_modules/@bower_components',
      '',
      'If you would like them to be available in previous location',
      'please consider adding following as postinstall script in package.json:',
      '',
      '"postinstall": "' + script + '"',
      '',
      'As a last step, please remove bower.json, .bowerrc',
      'and point your scripts to node_modules/@bower_components instead'
    ])
  }

  step(
    'Done',
    ['Your project is now converted to Yarn! Thank you for using Bower!'],
    true
  )
}

main()
