import { register } from 'pmtiles-protocol'

// Register must run only once (as it decorate OL code, and would
// decorate itself in run twice). So let's but in a module and
// make JS import cache deal with that for us.
register()
