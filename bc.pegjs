{
	"include BCPU";
	BCPU.location = location;
	BCPU.error = error;
}

S = head:statement? tail:(ST_SEP+ s:statement { return s; })* ws { return Main([head].concat(tail)); }

statement = module
	/ chain
	/ layout:layout

module
	= name:Id COPEN
		init:(i:init ST_SEP+ { return i; })?
		items:(i:module_item ST_SEP+ { return i; } )*
		CCLOSE { return Module(name, items, init) }

module_item = values / layout / chain

values = ENUM head:v_val tail:(COMMA v:v_val { return v; })* {
	return EnumDef([head].concat(tail));
}
v_val = name:Id val:(EQ v:INT {return v})? { 
	return EnumValDef(name, val);
}

init = INIT head:init_item tail:(COMMA ids:init_item { return ids; })* { return ModuleInit([head].concat(tail)); }
init_item = ids:idr cons:(EQ cons:Cons { return cons; })? { return ModuleInitItem(ids, cons || ConsConst(0)); }

//chains = head:chain tail:(SEMI c:chain { return c} )* { return [head].concat(tail); }

layout = UI ls:l_decls { return Layout(ls); }
l_decls = head:l_decl tail:(PIPE d:l_decl { return d })* { return [head].concat(tail); }
l_decl
	= COPEN decls:l_decls CCLOSE { return LayoutSub(decls); }
	/ decl:declRef { return LayoutDecl(decl); }

chain 
	= head:point links:(a:arrow p:point { return ChainLink(a, p); })* {
		return Chain(head, links);
	}

arrow
	= ARROW { return ChainArrow(false); }
	/ PARROW { return ChainArrow(true); }

range = a:INT b:('-' i:INT { return i; })? { return makeRange(a, b) }

idr0 = '_' r:range { return r.map(i => '_' + i); }

idr
	= id:id r:idr0? {
		if (!r) return [id];
		return r.map(i => id + i);
	}
	/// r:idrng

ports = BOPEN h:port1 t:(COMMA e:port1 {return e})* BCLOSE { return t.reduce((a, b) => a.concat(b), h); }
port1
	= idr:idr { return idr }
	/ range
	
point
	= head:item tail:(COMMA item:item { return item; })* { 
		return Point([head].concat(tail));
	}
	/// sub_chains

item
	= node
	/ POPEN c:chain PCLOSE { return c; }

//sub_chains = POPEN chains:chains PCLOSE { return chains; }

node = inp:ports? declRef:declRef out:ports? {
		return Node(inp, declRef, out);
	}
	

declRef = declaration / reference

declaration = type:Cons idr:(idr/idr0)? title:title? {
		return Decl(type, idr, title);
	}

reference = idr:idr title:title? {
		return Ref(idr, title);
	}

Cons
	= type:Id ps:params? {
		return ConsRef(type, ps);
	}
	/ 
	n:num {
		return ConsConst(n);
	}
	/
	MUL n:num? {
		return ConsGain(n === null ? 1 : n);
	}
	/
	p:processing {
		return ConsProc(p);
	}
	/
	ps:params {
		return ConsVec(ps);
	}
	/
	GLOBAL {
		return ConsGlobal();
	}

processing = COPEN init:proc_init? params:proc_params out:proc_out? body:(PIPE b:proc_body {return b})? CCLOSE {
	return Proc(params, body, init, out);
}
proc_init = AOPEN head:idr tail:(COMMA ids:idr { return ids; })* ACLOSE { return [head].concat(tail).reduce((a,b) => a.concat(b)); }
proc_params = h:proc_param t:(COMMA p:proc_param {return p})* { return [h].concat(t); }
proc_param = agr:AGR? name:id? def:(EQ v:num {return v})? { return ProcParam(agr, name, def); }
proc_body = CODE
proc_out = ARROW head:idr tail:(COMMA ids:idr { return ids; })* { return [head].concat(tail).reduce((a,b) => a.concat(b)); }

params = AOPEN head:param tail:(COMMA? p:param { return p })* COMMA? ACLOSE { return [head].concat(tail) }

param = pval
	// n:(n:id (EQ/COLON) { return n})?
	// v:pval { return {n:n, v: v} }

pval 
	= n:num { return ParamNum(n); }
	/ p:processing { return ParamProc(p); }
	/ idr:idr { return ParamRef(idr); }
	/// str
	/// note
	/ id:Id { return ParamEnum(id); }

num = HEX / BIN / QNUM / OCT / NUM
str = STR
note = n:NOTE { return noteToInt(n) }
tseq = TSEQ
title = STR2

code = '{' code:CODE '}' { return code; };

//--"lexer"

space = [ \t\r\n]
space0 = [ \t]
comment = '#' [^\r\n]*
ws "" = (space/comment)*
ws0 "" = (space0/comment)*
EOL = [\r\n]+
COPEN = ws '{' ws0
CCLOSE = ws '}' ws0
UPPER = [A-Z]
LOWER = [a-z]
LETTER = UPPER / LOWER
DIGIT = [0-9]
IDSYM = LETTER / DIGIT
Id "Identifier" = ws id:$(UPPER IDSYM*) ws0 { return id; }
id "ident" = ws id:$(LOWER IDSYM*) ws0 { return id; }
INT "integer" = ws num:$(('+'/'-')? DIGIT+) ws0 { return parseInt(num, 10); }
HEX "hexadecimal" =  ws '0x' hex:$([0-9A-Fa-f]+) ws0 { return parseInt(hex, 16); }
BIN "binary" =  ws '0b' hex:$([01]+) ws0 { return parseInt(hex, 2); }
QNUM "quaternary" =  ws '0q' n:$([0-3]+) ws0 { return parseInt(n, 4); }
OCT "binary" =  ws '0o' n:$([0-7]+) ws0 { return parseInt(n, 8); }
NUM "number" = ws num:$(('+'/'-')? DIGIT+ ('.' DIGIT+)?) ws0 { return parseFloat(num); }
COLON = ws ':' ws0
SEMI = ws ';' ws0
ARROW "->" = ws '-'+ '>' ws0
PARROW "=>" = ws '='+ '>' ws0
BOPEN = ws '[' ws0
BCLOSE = ws ']' ws0
COMMA = ws ',' ws0
POPEN = ws '(' ws0
PCLOSE = ws ')' ws0
AOPEN = ws '<' ws0
ACLOSE = ws '>' ws0
PIPE = ws '|' ws0
EQ = ws '=' ws0
STR "string" 
	= ws "'" s:$([^']*) "'" ws0 { return "'" + s + "'"; }
STR2 "string2" 
	= ws '"' s:$([^"]*) '"' ws0 { return '"' + s + '"'; }
NOTE = ws n:$([A-H] [#-b]? DIGIT?) ws0 { return n }
TSEQ = ws s:$([x.]+) ws0 { return s.split('').map(c => c == 'x' ? 1 : 0) }
ENUM = ws '@enum' !IDSYM ws0
UI = ws '@' ('ui'/'UI') !IDSYM ws0
INIT = ws '@' 'init' !IDSYM ws0
GLOBAL = ws '@' 'global' !IDSYM ws0
AGR = ws a:[*_^+] ws0 { return a }
MUL = ws '*' ws0

CODE = $(([^{}] / '{' CODE '}')*)

ST_SEP = SEMI / ws0 EOL ws

START_ABC = ('@start_abc' / '@startABC') ws0 EOL ws
END_ABC = ('@end_abc' / '@endABC') ws
