"""Compila reglas oficiales a datos (AST). Nunca evalúa código del archivo fuente."""
import re
def compilar(expresion):
    pattern=r'\d+(?:\.\d+)?|[A-Z_][A-Z_0-9]*|\'[^\']*\'|"[^"]*"|<=|>=|<>|!=|[=<>+*/()\-]'
    matches=list(re.finditer(pattern,expresion,re.I));last=0
    for m in matches:
        if expresion[last:m.start()].strip():raise ValueError('Carácter no permitido')
        last=m.end()
    if expresion[last:].strip() or len(matches)>3000:raise ValueError('Sintaxis no homologada')
    ts=[m.group() for m in matches];at=0
    def atom():
        nonlocal at
        if at>=len(ts):raise ValueError('Expresión incompleta')
        t=ts[at];at+=1
        if t=='(':
            v=parse(0)
            if at>=len(ts) or ts[at]!=')':raise ValueError('Paréntesis incompleto')
            at+=1;return v
        if t=='-':return {'op':'neg','a':atom()}
        if t.upper()=='LEN':
            if at>=len(ts) or ts[at]!='(':raise ValueError('LEN incompleto')
            at+=1;v=parse(0)
            if at>=len(ts) or ts[at]!=')':raise ValueError('LEN incompleto')
            at+=1;return {'op':'len','a':v}
        if re.fullmatch(r'\d+(?:\.\d+)?',t):return {'op':'valor','v':float(t) if '.' in t else int(t)}
        if t[0] in '\'"':return {'op':'valor','v':t[1:-1]}
        if re.fullmatch(r'(?:[VE]\d+|CV_[A-Z_0-9]+|DURACION|OFICIALIZADO)',t.upper()):return {'op':'ref','v':t.upper()}
        raise ValueError('Referencia no permitida: '+t)
    precedence={'OR':1,'AND':2,'=':3,'<>':3,'!=':3,'>':3,'<':3,'>=':3,'<=':3,'+':4,'-':4,'*':5,'/':5}
    def parse(minimum):
        nonlocal at
        left=atom()
        while at<len(ts) and ts[at].upper() in precedence and precedence[ts[at].upper()]>=minimum:
            op=ts[at].upper();at+=1;right=parse(precedence[op]+1);left={'op':op,'a':left,'b':right}
        return left
    result=parse(0)
    if at!=len(ts):raise ValueError('Tokens restantes')
    return result
