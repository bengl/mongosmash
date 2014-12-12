Pull requests, bug reports and feature requests are more than welcome, and should be done using Github PRs and Issues. Please try to conform to existing style (though I'm not very stylish), and don't forget tests and docs! Also, if making a performance improvement, feel free to update the benchmark data in the README. TODOs are in Github Issues.

Pull requests should be made against master.

Pull requests that *reduce* the coverage will not be merged. Check coverage by running `npm run coverage`.

The source is written in ES6 in the `src` directory and transpiled using Google's Traceur compiler with `npm run prepublish`, which outputs to the `lib` directory. Tests are not transpiled, but note that MongoSmash requires node 0.11.11+ and the `--harmony` flag, so you have those at your disposal.
