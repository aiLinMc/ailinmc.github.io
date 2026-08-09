var selectedGrades=new Set();
var selectedTerms=new Set();
var searchText="";
var gradeSort="desc";
var weekSort="asc";

var GRADE_ALL=["七年级","八年级","九年级"];
var TERM_ALL=["上学期","下学期"];

function toggleDarkMode(){
    document.body.classList.toggle("dark-mode");
    localStorage.setItem("darkMode",document.body.classList.contains("dark-mode"));
    updateDarkModeButton();
}

function updateDarkModeButton(){
    var btn=document.querySelector(".dark-mode-toggle");
    if(btn)btn.textContent=document.body.classList.contains("dark-mode")?"☀️":"🌙";
}

function updateFilterButtonsUI(){
    document.querySelectorAll(".filter-btn").forEach(function(btn){
        var type=btn.dataset.filter;
        var value=btn.dataset.value;
        var set=type==="grade"?selectedGrades:selectedTerms;

        if(value==="全部"){
            var all=type==="grade"?GRADE_ALL:TERM_ALL;
            btn.classList.toggle("active",all.every(function(v){return set.has(v)}));
        }else{
            btn.classList.toggle("active",set.has(value));
        }
    });
}

function normalizeQuery(s){
    return s.replace(/['"\s\-·]/g,"").toLowerCase();
}

function mixedSearch(query,text,map){
    var q=0,t=0;

    while(q<query.length&&t<text.length){
        var tc=text.charAt(t);
        var qc=query.charAt(q);

        if(tc<="\u007f"){
            if(tc.toLowerCase()===qc){
                q++;
            }
            t++;
            continue;
        }

        var py=map[tc];

        if(!py){
            t++;
            continue;
        }

        if(qc>="\u4e00"&&qc<="\u9fff"){
            if(tc===qc)q++;
            t++;
            continue;
        }

        if(query.substring(q,q+py.length)===py){
            q+=py.length;
            t++;
            continue;
        }

        if(py.charAt(0)===qc){
            q++;
            t++;
            continue;
        }

        t++;
    }

    return q>=query.length;
}

function applyFilter(){
    var cards=document.querySelectorAll(".week-card");
    var count=0;

    var q=normalizeQuery(searchText);
    var map=window.PINYIN_MAP||{};

    cards.forEach(function(card){
        var grade=card.dataset.grade;
        var term=card.dataset.term;
        var text=card.dataset.search||"";

        var gradeOk=selectedGrades.size&&selectedGrades.has(grade);
        var termOk=selectedTerms.size&&selectedTerms.has(term);

        var searchOk=!q;

        if(!searchOk){
            searchOk=
                normalizeQuery(text).indexOf(q)!==-1||
                mixedSearch(q,text,map);
        }

        if(gradeOk&&termOk&&searchOk){
            card.style.display="";
            count++;
        }else{
            card.style.display="none";
        }
    });

    var no=document.getElementById("no-results");
    if(no)no.style.display=count===0?"block":"none";

    var info=document.getElementById("resultInfo");
    if(info)info.textContent="共 "+count+" 个结果";
}

function applySort(){
    var grid=document.getElementById("cards-grid");
    if(!grid)return;

    var cards=[].slice.call(grid.querySelectorAll(".week-card"));

    var gradeOrder={
        "七年级":7,
        "八年级":8,
        "九年级":9
    };

    var termOrder={
        "上学期":1,
        "下学期":2
    };

    cards.sort(function(a,b){
        var ga=gradeOrder[a.dataset.grade];
        var gb=gradeOrder[b.dataset.grade];

        if(ga!==gb){
            return gradeSort==="asc"?ga-gb:gb-ga;
        }

        var ta=termOrder[a.dataset.term];
        var tb=termOrder[b.dataset.term];

        if(ta!==tb){
            return gradeSort==="asc"?ta-tb:tb-ta;
        }

        var wa=parseInt(a.dataset.week);
        var wb=parseInt(b.dataset.week);

        return weekSort==="asc"?wa-wb:wb-wa;
    });

    cards.forEach(function(card){
        grid.appendChild(card);
    });
}

document.addEventListener("DOMContentLoaded",function(){

    if(localStorage.getItem("darkMode")==="true"){
        document.body.classList.add("dark-mode");
    }

    updateDarkModeButton();

    GRADE_ALL.forEach(function(v){
        selectedGrades.add(v);
    });

    TERM_ALL.forEach(function(v){
        selectedTerms.add(v);
    });

    updateFilterButtonsUI();

    document.querySelectorAll(".filter-btn").forEach(function(btn){

        btn.addEventListener("click",function(){

            var type=this.dataset.filter;
            var value=this.dataset.value;

            var all=type==="grade"?GRADE_ALL:TERM_ALL;
            var set=type==="grade"?selectedGrades:selectedTerms;

            if(value==="全部"){

                var active=all.every(function(v){
                    return set.has(v);
                });

                if(active){
                    set.clear();
                }else{
                    all.forEach(function(v){
                        set.add(v);
                    });
                }

            }else{

                if(set.has(value)){
                    set.delete(value);
                }else{
                    set.add(value);
                }
            }

            updateFilterButtonsUI();
            applyFilter();
        });
    });


    document.getElementById("searchInput").addEventListener("input",function(){
        searchText=this.value;
        applyFilter();
    });


    document.getElementById("gradeSort").addEventListener("change",function(){
        gradeSort=this.value;
        applySort();
    });


    document.getElementById("weekSort").addEventListener("change",function(){
        weekSort=this.value;
        applySort();
    });


    applySort();
    applyFilter();
});