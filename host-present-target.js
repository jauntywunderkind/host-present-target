#!/usr/bin/env node
"use module"
import { Icmp} from "@jauntywunderkind/icmp"
import { systemdNotify} from "systemd-notify"
import AsyncLift from "processification/async-lift.js"

export function MaxRetriesError(){
	Error.call( this, "Maximum retries")
	return this
}
MaxRetriesError.prototype= Object.create( Error.prototype)
MaxRetriesError.prototype.constructor= MaxRetriesError

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
	function ping( host){
		return await Icmp.ping( host, self.timeout).diff
	}

	while( true){
		try{
			// try to get a ping
			const
				plural= typeof self.host!== "string"&& self.host.length,
				pings= plural?  await Promise.race( self.host.map( ping)): ping( self.host)

			if( self.absent){
				// host not absent, try again
				retry()
				continue
			}
			// ping succeeded, success
			return ping
		}catch( ex){
			if( self.absent){
				// host absent, success
				return
			}

			// host absent, try again
			retry()

			// interval
			const remainder= self.remainder
			if( remainder){
				await delay( remainder)
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


async function main(){
	
}
if( typeof process!== "undefined"&& `file://${ process.argv[ 1]}}`=== import.meta.url){
	main()
}
