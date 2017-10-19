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

const lastMessage = [
  'Your project is now converted to Yarn! Thank you for using Bower!',
  '',
  'You should find all bower components in node_modules/@bower_components',
  '',
  'The postinstall script should also link it to old location of components',
  '',
  'It is advisable to remove postinstall script and point your tools',
  'to point to node_modules/@bower_components instead, though.',
  '',
  'You may also consider creating separate directory for front-end project with separate package.json'
]

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
      step('Done', lastMessage, true)
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

  let hasComponentsDir = false

  try {
    if (fs.lstatSync(componentsDir).isDirectory()) {
      hasComponentsDir = true
    }
  } catch (e) {}

  let original = {}

  if (fs.existsSync('package.json')) {
    original = JSON.parse(fs.readFileSync('package.json'))
  }

  const expected = cloneDeep(original)

  let hadBowerComponents = false

  if (expected.dependencies) {
    Object.keys(expected.dependencies).forEach(function (k) {
      if (k.indexOf('@bower_components') >= 0) {
        hadBowerComponents = true
        delete expected.dependencies[k]
      }
    })
  }

  if (!hasComponentsDir && !hadBowerComponents) {
    step('Install dependencies with Bower', [
      'We need to install dependencies the old way first. Please run:',
      '$ bower install',
      '',
      'At the end you should see some packages in:',
      componentsDir
    ])
  }

  const source = path.relative(process.cwd(), componentsDir)

  if (hasComponentsDir) {
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

    const script =
      "node -e \"try { require('fs').symlinkSync(require('path').resolve('node_modules/@bower_components'), '" +
      source +
      "', 'junction') } catch (e) { }\""

    if (!expected.scripts) {
      expected.scripts = {}
    }

    if (
      !expected.scripts.postinstall ||
      expected.scripts.postinstall.indexOf('bower install') >= 0
    ) {
      expected.scripts.postinstall = script
    } else if (expected.scripts.postinstall.indexOf('symlinkSync') == -1) {
      expected.scripts.postinstall =
        expected.scripts.postinstall + ' && ' + script
    }

    if (!deepIs(expected, original)) {
      if (cli.flags.diff) {
        if (process.stdout.isTTY) {
          console.log(difflet.compare(original, expected, { indent: 2 }))
        }

        process.exit(0)
      } else if (cli.flags.apply) {
        fs.writeFileSync(
          'package.json',
          JSON.stringify(expected, null, 2) + '\n'
        )
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
  }

  let oldDirExists = false

  try {
    if (fs.lstatSync(componentsDir).isDirectory()) {
      oldDirExists = true
    }
  } catch (e) {}

  if (oldDirExists) {
    step('Remove old components directory', [
      'Now, please remove original components directory:',
      '$ rm -rf ' + source
    ])
  }

  if (!fs.existsSync(path.join(cwd, 'node_modules', '@bower_components'))) {
    step('Install dependencies with Yarn', [
      'Now install dependencies again with:',
      '$ yarn',
      '',
      'If you encounter issues during installation, please try:',
      '$ yarn --ignore-engines',
      '',
      'If it also fails, you can try following:',
      '$ yarn --ignore-engines --ignore-scripts && yarn postinstall',
      '',
      'You can use this command from now on to install both npm and bower dependencies!'
    ])
  }

  if (fs.existsSync(path.join(cwd, 'bower.json'))) {
    step('Remove bower.json and old bower components directory', [
      'As a last step, please remove bower.json and .bowerrc'
    ])
  }

  step('Done', lastMessage, true)
}

main()
