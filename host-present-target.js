#!/usr/bin/env node
"use module"
import Delay from "delay"
import Ping from "async-iter-ping/ping.js"
import Retry from "async-iter-retry/retry.js"
import AsyncLift from "processification/async-lift.js"
import systemdNotify from "systemd-notify"

export const stages= [
	"initial",
	// run two ipv4/ipv6 connect submachines until one has a connectable address
	"opening",
	// allow previous machines to aggregating addresses
	// while round robin pinging pool of pingable addresses
	// move inactive addresses into a lower prio background pool
	"open",
	// active pool goes empty,
	// re-connect, but this time with a deadline
	"half-closed",
	// fail to re-connect in time
	"closed"
]

export function HostPresent( opt){
	Object.defineProperties( this, {
		state: State.resolving
	})
}

export const hostPresent= AsyncLift( async function detect( res, rej, self, {
	host,
	timeout= 8000,
	interval= 16000,
	retries= -1,
	absent
}){
	// record our properties
	self.host= host
	self.timeout= timeout
	self.interval= interval
	self.retries= retries
	self.state= "ping"
	// synthetic remainder property
	Object.defineProperty( self, "remainder", {
		get: function(){
			const remainder= self.interval- self.timeout
			if( isNaN( remainder)|| remainder<= 0){
				return null
			}
			return remainder
		}
	})

	// utility to decrement retries
	function retry(){
		if( self.retries< 0){
			return
		}
		if( self.retries=== 0){
			throw new MaxRetriesError()
		}
		--self.retries
	}

	const pings= {}
	async function ping( host){
		if( !pings[ host]){
			pings[ host]=== new Ping( host)
		}
	}

	while( true){
		try{
			console.log("loop", typeof self.host, self.host.length, self.host)
			// try to get a ping
			const
				plural= typeof self.host!== "string"&& self.host.length,
				pings= plural? await Promise.race( self.host.map( ping)): await ping( self.host)

			if( self.absent){
				// host not absent, try again
				retry()
				continue
			}
			// ping succeeded, success
			return ping
		}catch( ex){
			console.log("ex", ex, self.remainder)
			if( self.absent){
				// host absent, success
				return
			}

			// host absent, try again
			retry()

			// interval
			const remainder= self.remainder
			if( remainder){
				await Delay( remainder)
			}
		}
	}
})
export default hostPresent

export function hostAbsent({ opts}){
	const wasUndetect= opts.absent
	opts.absent= true
	const value= present( opts)
	opts.absent= wasUndetect
	return value
}


async function main( opts= {}){
	const start= process.hrtime.bigint()
	let hosts= opts.hosts
	HOST: if( !hosts){
		let argParse= opts.argParse|| (argv=> argv.slice( 2))
		if( opts.argv){
			hosts= argParse( opts.argv)
			break HOST
		}
		let envKey= opts.envKey|| "HOST_PRESENT_TARGET_HOST"
		if( opts.env&& opts.env[ envKey]){
			hosts= opts.env[ envKey]
			break HOST
		}

		let process_= opts.process
		if( process_=== undefined){
			process_= process
		}else if( !process){
			break HOST
		}
		if( !opts.argv&& process_.argv){
			hosts= argParse( process_.argv)
			break HOST
		}
		if( !opts.env&& process_.env){
			hosts= process_.env[ envKey]
		}
	}
	if( !hosts){
		throw new Error("Required a target host")
	}
	if( typeof host=== "string"){
		host= host.split( ":")
	}

	let
		process_= opts.process|| process,
		env= process_&& process_.env|| {},
		timeout= env.HOST_PRESENT_TARGET_TIMEOUT,
		interval= env.HOST_PRESENT_TARGET_INTERVAL
	if( timeout){
		timeout= Number.parseInt( timeout)
	}
	if( interval){
		interval= Number.parseInt( interval)
	}

	// wait for host
	const ping= await hostPresent({ host: hosts, timeout, interval})
	console.log( JSON.stringify({ state: "present", host: ping.host|| ping.ip, ping: ping.diff, t: process.hrtime.bigint() - start}))
	// notify systemd the host is here
	await systemdNotify({
		ready: true
	})

	// wait for host to leave
	await hostAbsent({ host: hosts, timeout, interval})
	console.log( JSON.stringify({ state: "absent", t: process.hrtime.bigint() - start}))
	// terminate
	process.exit( 1)
}
if( typeof process!== "undefined"&& `file://${ process.argv[ 1]}`=== import.meta.url){
	main()
}
