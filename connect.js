import { promises as dns} from "dns"
import { Retry} from "@jauntywunderkind/retry"
import { createMachine, state as final, interpret as Interpret, invoke, reduce, state, transition} from "robot3"

export const stages= [
	"initial",
	"resolve",
	"ping",
	"open",
	"timeout"
]

function resolve( record= "A"){
	return async function resolve( ctx){
		return await dns
			.resolve( ctx.hostname, record)
			.then( function( value){
				let delay= ctx[ `delayResolve${record}`]
				if( delay instanceof Function){
					delay= delay.call( ctx, ctx)
				}
				if( delay){
					await Delay( delay)
				}
				return {
					[ record]: value
				}
			})
		}
	}
}

const
	resolve4= resolve( "A"),
	resolve6= resolve( "AAAA")

async function resolve(){
	let resolved= await Promise.race([
		resolve4,
		resolve6
	])
	for( let o in resolved){
		return resolved[ o]
	}
}

async function saveResolve( ctx, ev){
	ctx.ip= ev.data
	return ctx
}

async function ping(){
}

export const action= {
	resolve,
	ping
}

export const machine
