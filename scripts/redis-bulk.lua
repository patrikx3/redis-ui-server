--
-- Created by IntelliJ IDEA.
-- User: patrikx3
-- Date: 7/9/20
-- Time: 4:59 PM
-- To change this template use File | Settings | File Templates.
--
for i = 1, 100000, 1 do
    redis.call("SET", "bulk-key-"..i, i)
end

return "Ok!"


