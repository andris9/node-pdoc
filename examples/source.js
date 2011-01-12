
/**
 * my_alert(text1, [text2, [text3]]) -> undefined
 * - text1 (String): Text to be displayed
 * - text2 (String): Another text to be displayed
 * - text3 (String): Yet another text to be displayed
 * 
 * Displays an alert dialog with input values concated into one string.
 * Usage example:
 * 
 *     my_alert("hello", "world");
 *     // alerts "hello world"
 **/
function my_alert(text1, text2, text3){
    if(text2)text1+=" "+text2;
    if(text3)text1+=" "+text3;
    alert(text1);
}
 