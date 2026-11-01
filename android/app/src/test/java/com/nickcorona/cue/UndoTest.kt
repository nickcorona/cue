package com.nickcorona.cue

import androidx.test.core.app.ApplicationProvider
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config as RConfig
import java.time.Instant

@RunWith(RobolectricTestRunner::class)
@RConfig(sdk = [34])
class UndoTest {
    private val c get() = ApplicationProvider.getApplicationContext<android.content.Context>()
    private val step = JSONObject().put("kind", "routine_step").put("id", "r_m").put("step_id", "c").put("date", "2026-11-01")

    @Before fun clear() = Undo.forget(c)

    @Test fun aRoutineStepTickedHereCanBeUndoneEvenThoughTheServerSkipsIt() {
        Undo.remember(c, step, "Contacts in")
        val u = Undo.pick(c, null)!!
        assertEquals("Contacts in", u.getString("label"))
        assertEquals("c", u.getString("step_id"))
    }

    @Test fun theMoreRecentCheckOffWins() {
        Undo.remember(c, step, "Contacts in")
        val later = JSONObject().put("kind", "task").put("id", "t1").put("label", "Done in chat")
            .put("at", Instant.ofEpochMilli(System.currentTimeMillis() + 60_000).toString())
        assertEquals("Done in chat", Undo.pick(c, later)!!.getString("label"))
        val earlier = JSONObject(later.toString()).put("at", Instant.ofEpochMilli(System.currentTimeMillis() - 60_000).toString())
        assertEquals("Contacts in", Undo.pick(c, earlier)!!.getString("label"))
    }

    @Test fun focusBlocksAreLeftToTheServerAndOldTapsExpire() {
        Undo.remember(c, JSONObject().put("kind", "focus").put("id", "f1"), "Focus")
        assertNull(Undo.pick(c, null))
        Undo.remember(c, step, "Contacts in")
        assertNull(Undo.pick(c, null, System.currentTimeMillis() + 16 * 60_000))
    }

    @Test fun aTaskThatIsOpenOnHomeIsNeverOfferedForUndo() {
        val task = JSONObject().put("kind", "task").put("id", "t_rachel")
        Undo.remember(c, task, "Reply to Rachel")
        assertNull(Undo.pick(c, null, open = setOf(Undo.key(task))))
        val server = JSONObject(task.toString()).put("label", "Reply to Rachel").put("at", Instant.now().toString())
        Undo.forget(c)
        assertNull(Undo.pick(c, server, open = setOf(Undo.key(task))))
        assertEquals("Reply to Rachel", Undo.pick(c, server)!!.getString("label"))
    }
}
