node-pdoc
=========

[PDOC](http://pdoc.org) documenter for Node.JS

*Be warned, it's currently extremely hacky, just a proof of concept.*

PDOC is a JavaScript specific inline comment parser to create documentation from source code. Original PDOC is written in Ruby and it's documentation states that you need to *consult the built-in Rake tasks (in Rakefile) and the PDoc::Runner class (in lib/pdoc/runner.rb).* to run it which doesn't make much sense. JavaScript tools should be understandable to JavaScript devs but *consulting* with Ruby files might not be. That's why I decided to create node-pdoc. 

Installation
------------

  - `git clone git://github.com/andris9/node-pdoc.git`
  - `npm install optimist` (command line parser)
  - `npm install node-markdown` (markdown parser)

Usage
-----

`node pdoc.js -i include_dir -o docs.html`

Example to generate docs from .js files from the examples directory

`node pdoc.js -i examples -o examples/output.html`

Supported markup
----------------

Node-pdoc doesn't support Prototype classes and mixins. Currently constants are also not supported. Everything else should be quite fine.

See [PDOC manual](http://pdoc.org/syntax.html) for documentation.
